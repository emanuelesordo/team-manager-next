import {matchPlayerLabel} from './match-player-label.js';
/** Post-match review. The official fixture score and proposed event history are independent. */
import {amendEventForm,revisionHistory,resultReviewSection,resultReconciliationHistory} from './postmatch-controls.js';
import {cumulativeEventMinute,displayEventMinute} from './match-minutes.js';
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
 const matchHasScore=fixtureHasScore; // Compatibility fields are not an independent score.
 return {total:all.length,pending:pending.length,official:all.filter(e=>e.validation_status==='official').length,rejected:all.filter(e=>e.validation_status==='rejected').length,
  officialGoals:goals,fixtureHasScore,matchHasScore,
  scoreMismatch:false,
  knownGoalMismatch:fixtureHasScore&&(goals.home!==fixture.home_score||goals.away!==fixture.away_score)};
}
export function reviewPanel({match,fixture,competition,events=[],players=[],editingEventId=null,historyEventId=null,historyEntries=[],resultHistoryEntries=null}={}){
 const summary=reviewSummary(match,fixture,events);
 const names=new Map(players.map(p=>[p.id,matchPlayerLabel(p)]));
 const sorted=[...events].sort((a,b)=>(cumulativeEventMinute(a,competition)??999)-(cumulativeEventMinute(b,competition)??999)||String(a.created_at||'').localeCompare(String(b.created_at||'')));
 const score=fixture&&summary.fixtureHasScore?fixture.home_score+'–'+fixture.away_score:'Non disponibile';
 const summaryText='<div class="staff-review-summary"><div><b>'+summary.pending+'</b><small>Da verificare</small></div><div><b>'+summary.official+'</b><small>Ufficiali</small></div><div><b>'+summary.rejected+'</b><small>Scartati</small></div></div>';
 const discrepancy='';
 const coverage=summary.knownGoalMismatch?'<p class="staff-help">Gol con eventi ufficializzati: '+summary.officialGoals.home+'–'+summary.officialGoals.away+'. Risultato ufficiale: '+E(score)+'. Il risultato può essere valido anche senza tutti i marcatori identificati; non vengono creati eventi fittizi.</p>':'';
 const items=sorted.map(ev=>{
  const isPending=reviewable.has(ev.validation_status);
  const n=ev.player_id?names.get(ev.player_id)||'Giocatore non censito':'Marcatore / giocatore non indicato';
  const secondary=ev.secondary_player_id?names.get(ev.secondary_player_id)||'Giocatore non censito':'';
  const minute=displayEventMinute(ev,competition,'Minuto non noto');
  const scoreApplied=ev.payload?.score_applied===true||ev.payload?.counted_in_score===true;
  const editable=['live','finished'].includes(match?.status);
  const timing=ev.minute==null?'Evento passato · timestamp salvato, minuto da completare':
   ev.payload?.minute_provisional===true?'Minuto provvisorio stimato dall’orario di inizio':
   ev.timing_consistent===false&&Number.isFinite(Number(ev.timing_delta_seconds))?
    'Inserito '+Math.max(1,Math.round(Math.abs(Number(ev.timing_delta_seconds))/60))+' min '+(Number(ev.timing_delta_seconds)>0?'dopo':'prima')+' rispetto al minutaggio · verifica richiesta':
    ev.timing_consistent===true?'Timestamp coerente (±5 min)':'';
  const quick=editable&&ev.validation_status!=='rejected'?'<div class="event-review-votes">'+
   '<button type="button" class="event-react event-react-plus" data-event-reaction="1" data-event-id="'+E(ev.id)+'" aria-label="Conferma evento">+'+E(Number(ev.support_count)||0)+'</button>'+
   '<button type="button" class="event-react event-react-minus" data-event-reaction="-1" data-event-id="'+E(ev.id)+'" aria-label="Segnala errore">−'+E(Number(ev.dispute_count)||0)+'</button></div>':'';
  const canApprove=isPending&&editable&&ev.validation_status!=='disputed';
  const actions=isPending&&editable?
   '<div class="staff-event-buttons">'+quick+
   (canApprove?'<button type="button" class="staff-soft" data-staff-action="review-approve" data-event-id="'+E(ev.id)+'" data-event-status="'+E(ev.validation_status)+'">Ufficializza</button>':'<small>Evento contestato: rettifica i dati prima di riconfermare.</small>')+
   (scoreApplied?'<small>Per scartare: rettificare prima il risultato</small>':'<button type="button" class="staff-danger" data-staff-action="review-reject" data-event-id="'+E(ev.id)+'" data-event-status="'+E(ev.validation_status)+'">Scarta</button>')+'</div>':'';
  const mergeInfo=Number(ev.payload?.merged_reports)>0?'<small class="event-merge-info">'+E(Number(ev.payload.merged_reports)+1)+' segnalazioni unificate'+(ev.payload?.merge_conflicts&&Object.keys(ev.payload.merge_conflicts).length?' · dati discordanti':'')+'</small>':'';
  const extra=editable?mergeInfo+'<button type="button" class="staff-soft" data-staff-action="review-edit" data-event-id="'+E(ev.id)+'">Rettifica</button><button type="button" class="staff-soft" data-staff-action="review-history" data-event-id="'+E(ev.id)+'">Storico</button>':mergeInfo;
  const stateClass=ev.validation_status==='official'?'event-official':ev.validation_status==='disputed'?'event-disputed':'event-pending';
  return '<div class="staff-event-row '+stateClass+'"><div><strong>'+E(minute)+' · '+E(label(ev.event_type))+'</strong><span>'+E(ev.team_side==='team'?'Nostra squadra':ev.team_side==='opponent'?'Avversaria':'Squadra non specificata')+' · '+E(n)+(secondary?' · '+E(secondary):'')+'</span><small>'+E(statusLabel(ev.validation_status))+(timing?' · '+E(timing):'')+'</small></div>'+actions+extra+'</div>'+(editingEventId===ev.id?amendEventForm(ev,players,competition):'')+(historyEventId===ev.id?revisionHistory(historyEntries,competition):'');
 }).join('');
 return '<section class="staff-subpanel"><div class="staff-panel-heading"><div><span class="eyebrow">POSTPARTITA</span><h2>Revisione eventi</h2></div></div>'+
 '<p class="staff-help">Gli eventi tempestivi inseriti da admin o giocatori sono ufficiali. Eventi di altri utenti, senza minuto o inseriti oltre la tolleranza di 5 minuti restano da verificare. Una segnalazione negativa richiede rettifica e nuova conferma. Gli eventi scartati rimangono nello storico.</p>'+
 summaryText+resultReviewSection(match,fixture,summary)+(resultHistoryEntries?resultReconciliationHistory(resultHistoryEntries):'')+discrepancy+coverage+'<div class="staff-event-list">'+(items||'<p class="empty">Nessun evento. Un risultato ufficiale può essere registrato anche senza eventi o marcatori noti.</p>')+'</div></section>';
}
