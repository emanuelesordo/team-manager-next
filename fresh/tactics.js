/** Tactical decisions stored in app_match_tactical_changes. */
const E=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nameOf=(people,id)=>{const p=(people||[]).find(x=>x.id===id);return p?(String(p.last_name||'')+' '+String(p.first_name||'')).trim():'Giocatore'};
export function tacticalHistory(changes,people){
 const entries=(changes||[]).slice().sort((a,b)=>(a.minute??999)-(b.minute??999)||String(a.created_at).localeCompare(String(b.created_at)));
 if(!entries.length)return '<section class="tactic-history"><p class="staff-help">Nessuna variazione tattica registrata.</p></section>';
 return '<section class="tactic-history"><h3>Variazioni tattiche registrate</h3>'+
 entries.map(x=>{
  const positions=Array.isArray(x.positions)?x.positions:[];
  const labels=positions.map(pos=>E(nameOf(people,pos.player_id))+' · '+E(pos.slot)).join(' · ');
  return '<div class="tactic-entry"><div class="tactic-entry-head"><strong>'+E(x.minute)+'′</strong>'+
   '<b>'+E(x.formation_from||'—')+' → '+E(x.formation_to||'—')+'</b></div>'+
   (labels?'<small>'+labels+'</small>':'')+
   (x.notes?'<p>'+E(x.notes)+'</p>':'')+'</div>';
 }).join('')+'</section>';
}
export function staffTacticsPanel(ctx,m){
 const players=ctx.state.data?.players||[],matchPlayers=ctx.state.matchData?.players||[];
 const changes=ctx.state.matchData?.tacticalChanges||[];
 const latest=changes.length?[...changes].sort((a,b)=>b.minute-a.minute)[0]:null;
 const formation=latest?.formation_to||m.formation||'4-4-2';
 const roster=matchPlayers.filter(x=>['starter','bench'].includes(x.selection_status)||x.started);
 const options=[['','Posizione non assegnata'],...roster.map(row=>[row.player_id,nameOf(players,row.player_id)])];
 const previous=Array.isArray(latest?.positions)?latest.positions:[];
 const selected=slot=>{
  const historical=previous.find(x=>Number(x.slot)===slot);
  if(historical)return String(historical.player_id);
  if(latest)return '';
  return String(roster.find(x=>x.started&&Number(x.tactical_slot)===slot)?.player_id||'');
 };
 const slotFields=Array.from({length:11},(_,i)=>{
  const slot=i+1;
  return '<label class="staff-field"><span>Posizione '+slot+'</span><select data-tactic-slot="'+slot+'"'+(m.status!=='live'?' disabled':'')+'>'+
    options.map(([id,label])=>'<option value="'+E(id)+'"'+(selected(slot)===id?' selected':'')+'>'+E(label)+'</option>').join('')+
    '</select></label>';
 }).join('');
 const forms=['4-4-2','4-3-3','3-5-2','4-2-3-1','3-4-3','4-5-1','5-3-2'];
 const opts=[...new Set([...forms,formation])];
 const form='<form data-staff-form="tactics"><div class="staff-form-grid">'+
  '<label class="staff-field"><span>Minuto assoluto</span><input name="minute" type="number" min="0" max="300" required'+(m.status!=='live'?' disabled':'')+'></label>'+
  '<label class="staff-field"><span>Nuovo modulo</span><select name="formation_to"'+(m.status!=='live'?' disabled':'')+'>'+
  opts.map(x=>'<option value="'+E(x)+'"'+(x===formation?' selected':'')+'>'+E(x)+'</option>').join('')+'</select></label>'+
  '</div><div class="tactic-slots">'+slotFields+'</div>'+
  '<label class="staff-field"><span>Note</span><input maxlength="500" name="notes"'+(m.status!=='live'?' disabled':'')+'></label>'+
  (m.status==='live'?'<button class="staff-submit" type="submit">Registra variazione tattica</button>':'<p class="staff-help">Modifica disponibile soltanto durante il live.</p>')+
 '</form>';
 return '<section class="staff-subpanel"><div class="staff-panel-heading"><h2>Modulo e posizioni</h2></div>'+
  '<p class="staff-help">Non sostituisce la formazione iniziale. Il server verifica la presenza effettiva al minuto dichiarato.</p>'+
  (m.status==='live'?form:'')+tacticalHistory(changes,players)+'</section>';
}
export function tacticalPayload(form){
 const minute=Number(form.elements.minute?.value??'');
 const formation_to=String(form.elements.formation_to?.value||'');
 if(!Number.isInteger(minute)||minute<0||minute>300)throw Error('Minuto non valido');
 if(!/^[1-9](-[1-9]){1,4}$/.test(formation_to)||
  formation_to.split('-').reduce((s,n)=>s+Number(n),0)!==10)throw Error('Modulo non valido');
 const positions=[...form.querySelectorAll('[data-tactic-slot]')].filter(x=>x.value)
  .map(x=>({slot:Number(x.dataset.tacticSlot),player_id:x.value}));
 if(!positions.length)throw Error('Associa almeno un giocatore');
 if(new Set(positions.map(x=>x.player_id)).size!==positions.length)throw Error('Un giocatore è assegnato a più posizioni');
 return {minute,formation_to,positions,notes:String(form.elements.notes?.value||'').trim()};
}
