import {cumulativeEventMinute,displayEventMinute} from './match-minutes.js';
import {resultSplit,eventCoverage,verifiedEvents} from './analytics.js?clubs=20261003id';
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&#39;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=value=>Number(value).toLocaleString('it-IT',{minimumFractionDigits:1,maximumFractionDigits:1});
const cell=(label,value)=>'<div class="team-metric"><b>'+E(value)+'</b><small>'+E(label)+'</small></div>';
function splitRow(label,part){return '<tr><td><b>'+E(label)+'</b></td><td>'+part.played+'</td><td>'+part.wins+'</td><td>'+part.draws+'</td><td>'+part.losses+'</td><td>'+part.gf+'</td><td>'+part.ga+'</td></tr>'}
export function teamAnalyticsPanel(fixtures,team){
 const stats=resultSplit(fixtures,team);
 return '<section class="glass panel team-detail-stats"><div class="panel-heading"><h2>Squadra · analisi risultati</h2></div>'+
 '<div class="team-metric-grid">'+cell('Vittorie',stats.played?fmt(stats.wins*100/stats.played)+'%':'—')+
 cell('Porte inviolate',stats.cleanSheets)+
 cell('Gol per partita',stats.played?fmt(stats.gf/stats.played):'—')+
 cell('Gol concessi per gara',stats.played?fmt(stats.ga/stats.played):'—')+'</div>'+
 '<div class="table-scroller"><table class="standing-table"><thead><tr><th>Sede</th><th>G</th><th>V</th><th>N</th><th>P</th><th>GF</th><th>GS</th></tr></thead><tbody>'+
 splitRow('Casa',stats.home)+splitRow('Trasferta',stats.away)+'</tbody></table></div>'+
 '<p class="subnote">Solo partite ufficialmente terminate, con entrambi i punteggi presenti. Nessun evento individuale viene dedotto dai risultati.</p></section>';
}
export function eventAnalyticsPlaceholder(){
 return '<section class="glass panel event-analysis"><div class="panel-heading"><h2>Eventi e rimonte verificabili</h2></div><div data-event-analysis>Verifica eventi ufficializzati…</div></section>';
}
export function renderEventAnalytics(fixtures,matches,events,team,competitions=[]){
 const coverage=eventCoverage(fixtures,matches,events,team,competitions);
 const validated=verifiedEvents(events);
 const proposed=events.filter(e=>e.validation_status==='proposed').length;
 const status='<div class="team-metric-grid">'+cell('Eventi ufficializzati',validated.length)+cell('Proposte da verificare',proposed)+cell('Partite con timeline completa',coverage.complete+'/'+coverage.possible)+'</div>';
 if(!coverage.complete)return status+'<p class="staff-help">Le sequenze di gol non sono abbastanza complete e validate per dedurre rimonte, impatto o situazioni del punteggio. I risultati ufficiali restano visibili nelle altre sezioni.</p>';
 const g=coverage.goalSituations,a=coverage.concededSituations;
 return status+'<div class="team-metric-grid">'+cell('Rimonte documentate',coverage.comebacks)+cell('Rimonte avversarie',coverage.concededComebacks)+cell('Rimonte con vittoria',coverage.comebackWins)+'</div>'+
 '<div class="table-scroller"><table class="standing-table"><thead><tr><th>Situazione prima della rete</th><th>Gol fatti</th><th>Gol subiti</th></tr></thead><tbody>'+
 [['In vantaggio','ahead'],['In parità','equal'],['In svantaggio','behind']].map(([label,k])=>'<tr><td>'+label+'</td><td>'+g[k]+'</td><td>'+a[k]+'</td></tr>').join('')+'</tbody></table></div>'+
 '<p class="subnote">Calcolato solo per '+coverage.complete+' gare con tutti i gol certificati, minuto noto e punteggio finale riconciliato. Le altre gare sono escluse e non valgono zero per le metriche non disponibili.</p>';
}
export function fixtureEventsPanel(events,competition=null,fixture=null){
 const rows=(events||[]).filter(e=>e.event_type).sort((a,b)=>(cumulativeEventMinute(a,competition)??999)-(cumulativeEventMinute(b,competition)??999)||(a.stoppage_minute??0)-(b.stoppage_minute??0));
 if(!rows.length)return '';
 const goals=rows.filter(e=>['goal','penalty_goal','penalty_scored','own_goal'].includes(e.event_type)&&e.validation_status!=='rejected');
 const homeCount=goals.filter(e=>e.side==='home'&&e.event_type!=='own_goal'||e.side==='away'&&e.event_type==='own_goal').length;
 const awayCount=goals.filter(e=>e.side==='away'&&e.event_type!=='own_goal'||e.side==='home'&&e.event_type==='own_goal').length;
 const reconciled=fixture&&Number(fixture.home_score)===homeCount&&Number(fixture.away_score)===awayCount;
 let home=0,away=0;
 const badges=rows.map(e=>{
  const time=displayEventMinute(e,competition);
  const which=e.side==='home'?'Casa':e.side==='away'?'Ospiti':e.side||'';
  const goal=['goal','penalty_goal','penalty_scored','own_goal'].includes(e.event_type);
  if(goal){const scorer=e.event_type==='own_goal'?(e.side==='home'?'away':'home'):e.side;if(scorer==='home')home++;if(scorer==='away')away++;}
  const snapshot=goal&&reconciled?' · '+home+'–'+away:'';
  return '<div class="fixture-event-row"><b>'+E(time)+'</b><span>'+E(e.event_type)+' · '+E(which)+E(snapshot)+'</span><small>'+E(e.source||'')+'</small></div>'
 }).join('');
 return '<section class="inner-card fixture-events-panel"><h3>Eventi della fixture</h3><p class="staff-help">Eventi della partita in ordine cronologico. I parziali vengono mostrati solo quando tutti i gol riconciliano il risultato ufficiale.</p>'+badges+'</section>';
}
