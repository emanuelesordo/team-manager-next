/** Post-match review. The official fixture score and proposed event history are independent. */
const E=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const reviewable=new Set(['proposed','community_confirmed','disputed']);
const goalTypes=new Set(['goal','own_goal','penalty_scored']);
const label=t=>({'goal':'Gol','own_goal':'Autogol','penalty_scored':'Rigore segnato','penalty_missed':'Rigore sbagliato','yellow_card':'Ammonizione','red_card':'Espulsione','blue_card':'Cartellino blu','blue_return':'Rientro dal blu','substitution':'Cambio / uscita','period_end':'Fine periodo','assist':'Assist','other':'Altro'}[t]||t||'Evento');
const statusLabel=s=>({'official':'Ufficiale','proposed':'Proposto','community_confirmed':'Confermato dalla community','disputed':'Contestato','rejected':'Scartato'}[s]||s||'Da classificare');
export function reviewSummary(match,fixture,events=[]){
 const all=events||[],active=all.filter(e=>e.validation_status!=='rejected'),pending=all.filter(e=>reviewable.has(e.validation_status));
 const counted=active.filter(e=>e.validation_status==='official'&&goalTypes.has(e.event_type));
 const goals={home:0,away:0};
 for(const e of counted){
  if(!['team','opponent'].includes(e.team_side))continue;
  const home=(match?.home_away==='home'&&e.team_side==='team')||(match?.home_away==='away'&&e.team_side==='opponent');
  goals[e.event_type==='own_goal'?(home?'away':'home'):(home?'home':'away')]++;
 }
 const fixtureHasScore=Number.isInteger(fixture?.home_score)&&Number.isInteger(fixture?.away_score);
 const matchHasScore=Number.isInteger(match?.home_score)&&Number.isInteger(match?.away_score);
 return {total:all.length,pending:pending.length,official:all.filter(e=>e.validation_status==='official').length,rejected:all.filter(e=>e.validation_status==='rejected').length,
  officialGoals:goals,fixtureHasScore,matchHasScore,
  scoreMismatch:fixtureHasScore&&matchHasScore&&(fixture.home_score!==match.home_score||fixture.away_score!==match.away_score),
  knownGoalMismatch:fixtureHasScore&&(goals.home!==fixture.home_score||goals.away!==fixture.away_score)};
}
export function reviewPanel({match,fixture,events=[],players=[]}={}){
 const summary=reviewSummary(match,fixture,events);
 const names=new Map(players.map(p=>[p.id,[p.first_name,p.last_name].filter(Boolean).join(' ')]));
 const sorted=[...events].sort((a,b)=>(a.minute??999)-(b.minute??999)||String(a.created_at||'').localeCompare(String(b.created_at||'')));
 const score=fixture&&summary.fixtureHasScore?fixture.home_score+'–'+fixture.away_score:'Non disponibile';
 const op=match&&summary.matchHasScore?match.home_score+'–'+match.away_score:'Non disponibile';
 const summaryText='<div class="staff-review-summary"><div><b>'+summary.pending+'</b><small>Da verificare</small></div><div><b>'+summary.official+'</b><small>Ufficiali</small></div><div><b>'+summary.rejected+'</b><small>Scartati</small></div></div>';
 const discrepancy=summary.scoreMismatch?'<p class="data-warning" role="status">Risultato ufficiale '+E(score)+' e tabellino '+E(op)+' divergono. La validazione degli eventi non modifica automaticamente nessuno dei due risultati.</p>':'';
 const coverage=summary.knownGoalMismatch?'<p class="staff-help">Gol con eventi ufficializzati: '+summary.officialGoals.home+'–'+summary.officialGoals.away+'. Risultato ufficiale: '+E(score)+'. Il risultato può essere valido anche senza tutti i marcatori identificati; non vengono creati eventi fittizi.</p>':'';
 const items=sorted.map(ev=>{
  const isPending=reviewable.has(ev.validation_status);
  const n=ev.player_id?names.get(ev.player_id)||'Giocatore non censito':'Marcatore / giocatore non indicato';
  const secondary=ev.secondary_player_id?names.get(ev.secondary_player_id)||'Giocatore non censito':'';
  const minute=ev.minute==null?'Minuto non noto':String(ev.minute)+(ev.stoppage_minute?'+'+ev.stoppage_minute:'')+'′';
  const counted=ev.payload?.counted_in_score===true;
  const actions=isPending&&['live','finished'].includes(match?.status)?
   '<div class="staff-event-buttons"><button type="button" class="staff-soft" data-staff-action="review-approve" data-event-id="'+E(ev.id)+'" data-event-status="'+E(ev.validation_status)+'">Approva</button>'+
   (counted?'<small>Per scartare: rettificare prima il risultato</small>':'<button type="button" class="staff-danger" data-staff-action="review-reject" data-event-id="'+E(ev.id)+'" data-event-status="'+E(ev.validation_status)+'">Scarta</button>')+'</div>':'';
  return '<div class="staff-event-row"><div><strong>'+E(minute)+' · '+E(label(ev.event_type))+'</strong><span>'+E(ev.team_side==='team'?'Nostra squadra':ev.team_side==='opponent'?'Avversaria':'Squadra non specificata')+' · '+E(n)+(secondary?' · '+E(secondary):'')+'</span><small>'+E(statusLabel(ev.validation_status))+'</small></div>'+actions+'</div>';
 }).join('');
 return '<section class="staff-subpanel"><div class="staff-panel-heading"><div><span class="eyebrow">POSTPARTITA</span><h2>Revisione eventi</h2></div></div>'+
 '<p class="staff-help">Lo staff può ufficializzare o scartare le proposte una per volta. Gli eventi scartati rimangono nello storico. La revisione non assegna minuti, marcatori o assist sconosciuti e non riscrive i punteggi.</p>'+
 summaryText+discrepancy+coverage+'<div class="staff-event-list">'+(items||'<p class="empty">Nessun evento. Un risultato ufficiale può essere registrato anche senza eventi o marcatori noti.</p>')+'</div></section>';
}
