const E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const opts=(a,v)=>a.map(([k,n])=>'<option value="'+E(k)+'"'+(k===v?' selected':'')+'>'+E(n)+'</option>').join('');
const types=['goal','own_goal','penalty_scored','penalty_missed','assist','substitution','yellow_card','blue_card','blue_return','red_card','period_end','other'].map(x=>[x,x]);
const reasons=['','tactical','technical','injury','other','technical_choice','injury_prevention','disciplinary_prevention','standing_ovation','give_teammates_time'].map(x=>[x,x||'Non specificato']);
export function amendEventForm(ev,players=[]){
 if(!ev)return '';
 const people=[['','Non noto / assente'],...players.map(p=>[p.id,[p.last_name,p.first_name].filter(Boolean).join(' ')])];
 const inp=(n,l,v='',t='text',a='')=>'<label class="staff-field"><span>'+l+'</span><input name="'+n+'" type="'+t+'" value="'+E(v)+'" '+a+'></label>';
 const sel=(n,l,items,v)=>'<label class="staff-field"><span>'+l+'</span><select name="'+n+'">'+opts(items,v)+'</select></label>';
 return '<form class="staff-amend-form staff-form" data-staff-form="amend-event" data-event-id="'+E(ev.id)+'" data-event-status="'+E(ev.validation_status)+'"><h3>Rettifica con storico</h3>'+
 '<p class="staff-help">La versione precedente sarà conservata; l’evento modificato torna proposto finché non viene validato.</p>'+
 (ev.payload?.counted_in_score?'<p class="data-warning">Evento conteggiato nel risultato: non cambiare tipo o squadra.</p>':'')+
 '<div class="staff-form-grid">'+
 sel('event_type','Tipo evento',types,ev.event_type)+sel('team_side','Squadra',[['team','Nostra'],['opponent','Avversaria']],ev.team_side)+
 sel('player_id','Giocatore / uscente',people,ev.player_id||'')+sel('secondary_player_id','Assist / entrante',people,ev.secondary_player_id||'')+
 inp('minute','Minuto assoluto',ev.minute??'','number','min="0" max="300" placeholder="Sconosciuto"')+
 inp('stoppage_minute','Recupero',ev.stoppage_minute??'','number','min="0" max="30"')+
 sel('substitution_reason','Motivo sostituzione',reasons,ev.substitution_reason||'')+
 inp('notes','Note',ev.payload?.notes||'','text','maxlength="400"')+
 inp('reason','Motivo rettifica','','text','required minlength="5" maxlength="500"')+
 '</div><div class="staff-event-buttons"><button class="staff-submit" type="submit">Salva rettifica</button><button class="staff-soft" type="button" data-staff-action="review-cancel-edit">Annulla</button></div></form>';
}
export function revisionHistory(rows=[]){
 if(!rows.length)return '<p class="staff-help">Nessuna rettifica registrata.</p>';
 return '<div class="staff-revision-history"><h4>Storico rettifiche</h4>'+rows.map(r=>'<div class="staff-event-row"><strong>'+E(new Date(r.created_at).toLocaleString('it-IT'))+'</strong><span>'+E(r.reason)+'</span><small>Prima: '+E(r.previous_record?.event_type)+' ('+E(r.previous_record?.minute??'minuto ignoto')+') → dopo: '+E(r.next_record?.event_type)+' ('+E(r.next_record?.minute??'minuto ignoto')+')</small></div>').join('')+'</div>';
}
export function resultReconciliationHistory(rows=[]){
 if(!rows.length)return '<p class="staff-help">Nessun allineamento manuale registrato.</p>';
 return '<div class="staff-revision-history"><h4>Storico allineamenti risultato</h4>'+rows.map(r=>
 '<div class="staff-event-row"><strong>'+E(new Date(r.created_at).toLocaleString('it-IT'))+'</strong><span>'+E(r.old_home_score)+'–'+E(r.old_away_score)+' → '+E(r.new_home_score)+'–'+E(r.new_away_score)+'</span></div>').join('')+'</div>';
}
export function resultReviewSection(m,f,s){
 if(!m||!f)return '';
 const confirmed=m.result_review_status==='confirmed',finished=m.status==='finished'&&f.status==='finished';
 const history='<button type="button" class="staff-soft" data-staff-action="review-result-history">Storico allineamenti</button>';
 let h='<section class="staff-result-review"><h3>'+(confirmed?'Risultato confermato':'Risultato da verificare')+'</h3><p class="staff-help">Conclusione partita e conferma risultato sono distinte. Marcatori ignoti restano ignoti.</p>';
 if(!finished)return h+'<p class="staff-help">Disponibile dopo la conclusione della partita.</p>'+history+'</section>';
 if(confirmed)return h+'<p class="staff-help">Confermato il '+E(m.result_reviewed_at?new Date(m.result_reviewed_at).toLocaleString('it-IT'):'—')+'. Nuove modifiche revocano la conferma.</p><button type="button" class="staff-soft" data-staff-action="review-result-reopen">Riapri verifica</button>'+history+'</section>';
 if(s.scoreMismatch)h+='<p class="data-warning">Risultati discordanti: la fixture è la fonte ufficiale.</p><button type="button" class="staff-soft" data-staff-action="review-result-align">Allinea solo il tabellino al risultato ufficiale</button>';
 if(s.pending)h+='<p class="data-warning">'+s.pending+' eventi ancora da verificare.</p>';
 const can=s.pending===0&&!s.scoreMismatch&&s.fixtureHasScore&&s.matchHasScore;
 return h+'<button type="button" class="staff-submit" data-staff-action="review-result-confirm"'+(can?'':' disabled')+'>Conferma risultato definitivo</button>'+history+'</section>';
}
