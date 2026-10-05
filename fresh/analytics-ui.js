import {cumulativeEventMinute,displayEventMinute} from './match-minutes.js';
import {resultSplit,eventCoverage,verifiedEvents,seasonNumbers} from './analytics.js?stats=20261005legacy1';

const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(value,digits=1)=>Number(value).toLocaleString('it-IT',{minimumFractionDigits:digits,maximumFractionDigits:digits});
const cell=(label,value)=>'<div class="team-metric"><b>'+E(value)+'</b><small>'+E(label)+'</small></div>';
const playerName=p=>String((p?.last_name||'')+' '+(p?.first_name||'')).trim()||'Giocatore';
const splitRow=(label,part)=>'<tr><td><b>'+E(label)+'</b></td><td>'+part.played+'</td><td>'+part.wins+'</td><td>'+part.draws+'</td><td>'+part.losses+'</td><td>'+part.gf+'</td><td>'+part.ga+'</td></tr>';

function sortedPlayers(players,key,limit=7){
 return [...(players||[])].filter(x=>x?.[key]!=null&&Number.isFinite(Number(x[key]))&&Number(x[key])>0)
  .sort((a,b)=>Number(b[key])-Number(a[key])||playerName(a).localeCompare(playerName(b),'it')).slice(0,limit);
}
function ranking(title,players,key,{digits=0,empty='Nessun dato registrato'}={}){
 const rows=sortedPlayers(players,key);
 const peak=Number(rows[0]?.[key])||1;
 return '<section class="glass panel leaderboard"><div class="panel-heading"><h2>'+E(title)+'</h2></div>'+
  (rows.length?rows.map((r,i)=>'<div class="leader-row"><span class="leader-position">'+String(i+1).padStart(2,'0')+'</span>'+
   '<strong>'+E(playerName(r))+'</strong><div class="leader-bar"><span style="width:'+Math.max(3,Math.round(Number(r[key])/peak*100))+'%"></span></div>'+
   '<b>'+E(digits?Number(r[key]).toFixed(digits):r[key])+'</b></div>').join(''):'<div class="empty">'+E(empty)+'</div>')+'</section>';
}
function lastResults(rows,opponents=[]){
 const recent=[...(rows||[])].slice(-8).reverse();
 if(!recent.length)return '<div class="empty">Nessun risultato disponibile.</div>';
 return '<div class="stats-form">'+recent.map(m=>{
  const o=opponents.find(x=>String(x.id)===String(m.opponent_id));
  const label=o?.short_name||o?.name||'Avversaria';
  return '<div class="team-metric"><b>'+m.goals+'–'+m.conceded+'</b><small>'+E(label)+' · '+({W:'V',D:'N',L:'P'}[m.result]||m.result)+'</small></div>';
 }).join('')+'</div>';
}
function goalDistribution(team){
 const total=Math.max(1,(team.goalIntervals||[]).reduce((a,b)=>a+b,0));
 const labels=['1T · prima metà','1T · seconda metà','2T · prima metà','2T · seconda metà'];
 return '<section class="glass panel leaderboard"><div class="panel-heading"><h2>Distribuzione dei gol</h2></div>'+
  labels.map((label,i)=>'<div class="leader-row"><span class="leader-position">'+String(i+1).padStart(2,'0')+'</span>'+
   '<strong>'+E(label)+'</strong><div class="leader-bar"><span style="width:'+Math.max(team.goalIntervals[i]?3:0,Math.round((team.goalIntervals[i]||0)/total*100))+'%"></span></div>'+
   '<b>'+E(team.goalIntervals[i]||0)+'</b></div>').join('')+'</section>';
}
function balance(team){
 const pct=v=>team.played?Math.round(v*100/team.played):0;
 return '<section class="glass panel"><div class="panel-heading"><h2>Bilancio dei risultati</h2></div>'+
  '<div class="team-metric-grid">'+cell('Vittorie',team.wins+' · '+pct(team.wins)+'%')+cell('Pareggi',team.draws+' · '+pct(team.draws)+'%')+
  cell('Sconfitte',team.losses+' · '+pct(team.losses)+'%')+cell('Porte inviolate',team.cleanSheets)+'</div></section>';
}
function venue(team){
 return '<section class="glass panel"><div class="panel-heading"><h2>Casa e trasferta</h2></div><div class="team-metric-grid">'+
  cell('Casa · partite',team.home.played)+cell('Casa · GF / GS',team.home.gf+' / '+team.home.ga)+
  cell('Trasferta · partite',team.away.played)+cell('Trasferta · GF / GS',team.away.gf+' / '+team.away.ga)+'</div></section>';
}
function discipline(team,players){
 const cards='<section class="glass panel"><div class="panel-heading"><h2>Disciplina</h2></div><div class="team-metric-grid">'+
  cell('Gialli',team.yellows)+cell('Blu',team.blues)+cell('Rossi',team.reds)+cell('Sostituzioni',team.substitutions)+'</div></section>';
 return cards+ranking('Più sanzionati',players,'disciplinary_cards');
}

export function teamAnalyticsPanel(fixtures,team){
 const stats=resultSplit(fixtures,team);
 return '<section class="glass panel team-detail-stats"><div class="panel-heading"><h2>Squadra · analisi risultati</h2></div>'+
 '<div class="team-metric-grid">'+cell('Vittorie',stats.played?fmt(stats.wins*100/stats.played)+'%':'—')+
 cell('Porte inviolate',stats.cleanSheets)+cell('Gol per partita',stats.played?fmt(stats.gf/stats.played):'—')+
 cell('Gol concessi per gara',stats.played?fmt(stats.ga/stats.played):'—')+'</div>'+
 '<div class="table-scroller"><table class="standing-table"><thead><tr><th>Sede</th><th>G</th><th>V</th><th>N</th><th>P</th><th>GF</th><th>GS</th></tr></thead><tbody>'+
 splitRow('Casa',stats.home)+splitRow('Trasferta',stats.away)+'</tbody></table></div></section>';
}

export function eventAnalyticsPlaceholder(){
 return '<div data-event-analysis><section class="glass panel event-analysis"><div class="panel-heading"><h2>Statistiche stagione</h2></div><div class="empty">Caricamento numeri…</div></section></div>';
}

export function renderEventAnalytics(fixtures,matches,events,team,competitions=[],playerStats=[],opponents=[]){
 const numbers=seasonNumbers(fixtures,matches,events,team,competitions,playerStats);
 const coverage=eventCoverage(fixtures,matches,events,team,competitions);
 const validated=verifiedEvents(events);
 const proposed=(events||[]).filter(e=>e.validation_status==='proposed').length;
 const diff=numbers.gf-numbers.ga;
 const header='<section class="glass panel stats-intro"><div><span class="eyebrow">STAGIONE IN NUMERI</span><h2>'+numbers.gf+
  ' gol segnati <span>/</span> '+numbers.ga+' subiti</h2><p>'+numbers.played+' gare concluse con risultato valido</p></div></section>';
 const core='<div class="team-metric-grid">'+cell('Partite',numbers.played)+cell('Gol fatti',numbers.gf)+cell('Gol subiti',numbers.ga)+
  cell('Differenza reti',(diff>0?'+':'')+diff)+cell('Porte inviolate',numbers.cleanSheets)+cell('Sostituzioni',numbers.substitutions)+'</div>';
 const period='<section class="glass panel"><div class="panel-heading"><h2>Gol per tempo</h2></div><div class="team-metric-grid">'+
  cell('1° tempo',numbers.goalsByPeriod[0])+cell('2° tempo',numbers.goalsByPeriod[1])+
  cell('Subiti 1° tempo',numbers.concededByPeriod[0])+cell('Subiti 2° tempo',numbers.concededByPeriod[1])+'</div></section>';
 const advanced='<section class="glass panel event-analysis"><div class="panel-heading"><h2>Eventi e rimonte verificabili</h2></div>'+
  '<div class="team-metric-grid">'+cell('Eventi ufficializzati',validated.length)+cell('Proposte registrate',proposed)+
  cell('Timeline complete',coverage.complete+'/'+coverage.possible)+'</div>'+
  (coverage.complete?'<div class="team-metric-grid">'+cell('Rimonte documentate',coverage.comebacks)+
   cell('Rimonte avversarie',coverage.concededComebacks)+cell('Rimonte con vittoria',coverage.comebackWins)+'</div>'+
   '<div class="table-scroller"><table class="standing-table"><thead><tr><th>Situazione prima della rete</th><th>Gol fatti</th><th>Gol subiti</th></tr></thead><tbody>'+
   [['In vantaggio','ahead'],['In parità','equal'],['In svantaggio','behind']].map(([label,k])=>'<tr><td>'+label+'</td><td>'+coverage.goalSituations[k]+'</td><td>'+coverage.concededSituations[k]+'</td></tr>').join('')+
   '</tbody></table></div>':'<p class="subnote">Rimonte e situazione del punteggio richiedono una timeline dei gol completa e riconciliata. Le altre statistiche della pagina restano comunque disponibili.</p>')+'</section>';
 return header+'<section class="glass panel">'+core+'</section><div class="leaderboard-grid">'+
  balance(numbers)+venue(numbers)+ranking('Classifica marcatori',playerStats,'goals')+ranking('Assist',playerStats,'assists')+
  ranking('Minuti giocati',playerStats,'minutes')+ranking('Media voti',playerStats,'avg_rating',{digits:2,empty:'Nessun voto valido'})+
  goalDistribution(numbers)+discipline(numbers,playerStats)+'</div>'+
  '<section class="glass panel"><div class="panel-heading"><h2>Ultime partite</h2></div>'+lastResults(numbers.matches,opponents)+'</section>'+
  period+advanced+'<p class="subnote">Fonte: partite concluse, tabellini ed eventi registrati. Gli eventi rifiutati sono esclusi; i voti SV non entrano nella media.</p>';
}

export function fixtureEventsPanel(events,competition=null,fixture=null){
 const rows=(events||[]).filter(e=>e.event_type&&e.validation_status!=='rejected').sort((a,b)=>(cumulativeEventMinute(a,competition)??999)-(cumulativeEventMinute(b,competition)??999)||(a.stoppage_minute??0)-(b.stoppage_minute??0));
 if(!rows.length)return '';
 const goals=rows.filter(e=>['goal','penalty_goal','penalty_scored','own_goal'].includes(e.event_type)&&e.validation_status!=='rejected');
 const homeCount=goals.filter(e=>e.side==='home'&&e.event_type!=='own_goal'||e.side==='away'&&e.event_type==='own_goal').length;
 const awayCount=goals.filter(e=>e.side==='away'&&e.event_type!=='own_goal'||e.side==='home'&&e.event_type==='own_goal').length;
 const hasUntimedGoals=goals.some(e=>cumulativeEventMinute(e,competition)===null);
 const reconciled=!hasUntimedGoals&&fixture&&Number(fixture.home_score)===homeCount&&Number(fixture.away_score)===awayCount;
 let home=0,away=0;
 const badges=rows.map(e=>{
  const time=displayEventMinute(e,competition);
  const which=e.side==='home'?'Casa':e.side==='away'?'Ospiti':e.side||'';
  const goal=['goal','penalty_goal','penalty_scored','own_goal'].includes(e.event_type);
  if(goal){const scorer=e.event_type==='own_goal'?(e.side==='home'?'away':'home'):e.side;if(scorer==='home')home++;if(scorer==='away')away++;}
  const snapshot=goal&&reconciled&&cumulativeEventMinute(e,competition)!==null?' · '+home+'–'+away:'';
  return '<div class="fixture-event-row"><b>'+E(time)+'</b><span>'+E(e.event_type)+' · '+E(which)+E(snapshot)+'</span><small>'+E(e.source||'')+'</small></div>';
 }).join('');
 return '<section class="inner-card fixture-events-panel"><h3>Eventi della fixture</h3><p class="staff-help">Eventi della partita in ordine cronologico. I parziali vengono mostrati solo quando tutti i gol riconciliano il risultato ufficiale.</p>'+badges+'</section>';
}
