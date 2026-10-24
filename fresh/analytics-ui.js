import {cumulativeEventMinute,displayEventMinute} from './match-minutes.js';
import {aggregateEventDetails,DETAIL_METRICS} from './event-detail-stats.js';
import {resultSplit,eventCoverage,verifiedEvents,seasonNumbers} from './analytics.js?stats=20261013sourcefacts1';
import {buildTeamProfile,profileHighlights} from './team-profile.js';
import {analyseResults} from './result-intelligence.js';

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
function resultProfilePanel(profile){
 const pct=v=>v==null?'—':Math.round(Number(v)*100)+'%';
 const vol=profile?.volatility==null?'—':Number(profile.volatility).toFixed(2);
 return '<section class="glass panel"><div class="panel-heading"><div><span class="eyebrow">CONF. A · RISULTATI</span><h2>Profilo delle partite</h2></div></div>'+
  '<div class="team-metric-grid">'+
   cell('Clean sheet',pct(profile.cleanSheet))+
   cell('Partite senza segnare',pct(profile.failToScore))+
   cell('Gare da 3+ gol',pct(profile.openRate))+
   cell('Gare entro 1 gol',pct(profile.tightRate))+
   cell('Vittorie di 2+ gol',pct(profile.bigWinRate))+
   cell('Sconfitte di 2+ gol',pct(profile.bigLossRate))+
   cell('Volatilità margine',vol)+
   cell('GF / GS per gara',fmt(profile.gfpg)+' / '+fmt(profile.gapg))+
  '</div><p class="subnote">Questi indicatori richiedono solo risultati finali affidabili e restano disponibili anche quando gli eventi della partita sono assenti.</p></section>';
}
function resultIntelligencePanel(result){
 const r=result||{},m=r.margins||{},v=r.venue||{};
 const pct=x=>x==null?'—':Math.round(100*x)+'%';
 const number=x=>x==null?'—':fmt(x,2);
 const group=(key,label)=>{const x=r.opponentTier?.[key]||{};return '<tr><td><b>'+label+'</b></td><td>'+E(x.matches||0)+'</td><td>'+number(x.ppg)+'</td><td>'+number(x.gfpg)+'</td><td>'+number(x.gapg)+'</td><td>'+number(x.gdpg)+'</td></tr>'};
 const results='<section class="glass panel event-analysis"><div class="panel-heading"><h2>Profili di risultato</h2></div>'+
  '<div class="team-metric-grid">'+cell('Entrambe segnano',pct(r.bothScore?.rate))+cell('0–1 gol totali',pct(r.totalGoals?.zeroOneRate))+
  cell('2 gol totali',pct(r.totalGoals?.twoRate))+cell('3+ gol totali',pct(r.totalGoals?.threePlusRate))+
  cell('Margine medio',number(r.marginStats?.mean))+cell('Margine mediano',number(r.marginStats?.median))+
  cell('Margine vittorie',number(r.marginStats?.winning))+cell('Margine sconfitte',number(r.marginStats?.losing))+
  cell('Variabilità GF / GS',number(r.marginStats?.goalsForStd)+' / '+number(r.marginStats?.goalsAgainstStd))+
  cell('Forma ultime 5',pct(r.form?.raw))+cell('Forma corretta per rango',pct(r.form?.opponentAdjusted))+
  cell('Indice forza stimata',r.strength?.index??'—')+'</div>'+
  '<div class="table-scroller"><table class="standing-table"><thead><tr><th>Scarto finale</th><th>Gare</th></tr></thead><tbody>'+
  [['Vittoria +1','win1'],['Vittoria +2','win2'],['Vittoria +3 o più','win3plus'],['Parità','draw'],['Sconfitta −1','loss1'],['Sconfitta −2','loss2'],['Sconfitta −3 o più','loss3plus']].map(([label,k])=>'<tr><td>'+label+'</td><td>'+E(m[k]||0)+'</td></tr>').join('')+
  '</tbody></table></div></section>';
 const rank='<section class="glass panel event-analysis"><div class="panel-heading"><h2>Contro avversarie di diverso rango</h2></div>'+
  '<div class="table-scroller"><table class="standing-table"><thead><tr><th>Rango</th><th>G</th><th>PT/G</th><th>GF/G</th><th>GS/G</th><th>DR/G</th></tr></thead><tbody>'+
  group('higher','Superiore')+group('similar','Simile')+group('lower','Inferiore')+'</tbody></table></div>'+
  '<p class="subnote">Rango stimato prima di ciascuna gara, senza leggere risultati successivi. Gare con confronto ancora incerto escluse dai tre gruppi: '+E(r.opponentTier?.unknown?.matches||0)+'.</p></section>';
 const selections=[['Casa',v.home],['Trasferta',v.away],...(v.bySurface||[]).filter(x=>x.matches>=2).map(x=>['Superficie: '+x.label,x]),...(v.byWidth||[]).filter(x=>x.matches>=2).map(x=>['Larghezza: '+x.label,x]),...(v.byLength||[]).filter(x=>x.matches>=2).map(x=>['Lunghezza: '+x.label,x])];
 const place='<section class="glass panel event-analysis"><div class="panel-heading"><h2>Casa, trasferta e tipo di campo</h2></div>'+
  '<div class="table-scroller"><table class="standing-table"><thead><tr><th>Sede / profilo</th><th>G</th><th>PT/G</th><th>GF/G</th><th>GS/G</th></tr></thead><tbody>'+
  selections.map(([label,row])=>'<tr><td><b>'+E(label)+'</b></td><td>'+E(row?.matches||0)+'</td><td>'+number(row?.ppg)+'</td><td>'+number(row?.gfpg)+'</td><td>'+number(row?.gapg)+'</td></tr>').join('')+
  '</tbody></table></div></section>';
 const strength='<section class="glass panel event-analysis"><div class="panel-heading"><h2>Forza stimata nel tempo</h2></div>'+
  '<div class="team-metric-grid">'+cell('Indice recente',r.strength?.index??'—')+cell('Variazione ultime gare',r.strength?.deltaFive==null?'—':(r.strength.deltaFive>0?'+':'')+r.strength.deltaFive)+
  cell('Risultato vs previsto',r.vsPrediction?.matches?(r.vsPrediction.delta>=0?'+':'')+number(r.vsPrediction.delta)+' punti':'Non disponibile')+'</div>'+
  '<p class="subnote">Il trend è un indice Elo descrittivo, non una probabilità. Lo scostamento dal pronostico richiede previsioni archiviate prima del calcio d’inizio; le previsioni ricalcolate dopo la gara non vengono utilizzate.</p></section>';
 const scorelines='<section class="glass panel event-analysis"><div class="panel-heading"><h2>Risultati esatti ricorrenti</h2></div>'+
  '<div class="team-metric-grid">'+(r.scorelines||[]).slice(0,6).map(x=>cell(x.count+' su '+r.played+' gare',x.score)).join('')+'</div></section>';
 return results+scorelines+rank+place+strength;
}
function progressionsPanel(gs={},halftime={}){
 const count=Number(gs.matches)||0;
 const first='<section class="glass panel"><div class="panel-heading"><h2>Primo gol e risposta</h2></div><div class="team-metric-grid">'+
  cell('Vince segnando per prima',gs.firstScored?(Math.round(gs.firstScoredWinRate*100)+'% · '+gs.firstScored+' gare'):'—')+
  cell('Perde subendo per prima',gs.firstConceded?(Math.round(gs.firstConcededLossRate*100)+'% · '+gs.firstConceded+' gare'):'—')+
  cell('Punti persi dopo 1–0',gs.firstScored?gs.pointsDroppedAfterFirst:'—')+
  cell('Punti recuperati dopo 0–1',gs.firstConceded?gs.pointsRecoveredAfterFirstConceded:'—')+
  cell('Sempre entro 1 gol',count?gs.closeThroughout+' / '+count:'—')+
  cell('Da +1 a +2',count?gs.doubleLeads:'—')+cell('Avversaria accorcia da +2',count?gs.opponentNarrowing:'—')+
  cell('Risposta entro 5′ · fatti/subiti',count?gs.quick5For+' / '+gs.quick5Against:'—')+
  cell('Risposta entro 10′ · fatti/subiti',count?gs.quickResponsesFor+' / '+gs.quickResponsesAgainst:'—')+'</div>'+
  '<p class="subnote">Campione: '+count+' timeline gol riconciliate. Reazioni calcolate sul lato squadra/avversaria, senza attribuire causalità.</p></section>';
 const trans=Object.entries(gs.progressions||{}).flatMap(([side,items])=>Object.entries(items).map(([step,n])=>({side,step,n})))
  .sort((a,b)=>b.n-a.n||a.step.localeCompare(b.step)).slice(0,10);
 const scores='<section class="glass panel event-analysis"><div class="panel-heading"><h2>Progressione del punteggio</h2></div>'+
  (trans.length?'<div class="table-scroller"><table class="standing-table"><thead><tr><th>Parziale → parziale</th><th>Gol</th><th>N</th></tr></thead><tbody>'+
   trans.map(x=>'<tr><td><b>'+E(x.step)+'</b></td><td>'+E(x.side==='team'?'Squadra':'Avversaria')+'</td><td>'+x.n+'</td></tr>').join('')+'</tbody></table></div>':
   '<p class="subnote">Non ci sono ancora timeline riconciliate con reti.</p>')+'</section>';
 const row=(key,label)=>{const x=halftime[key]||{};return '<tr><td><b>'+label+'</b></td><td>'+E(x.matches||0)+'</td><td>'+E(x.wins||0)+'</td><td>'+E(x.draws||0)+'</td><td>'+E(x.losses||0)+'</td></tr>'};
 const half='<section class="glass panel event-analysis"><div class="panel-heading"><h2>Intervallo → risultato finale</h2></div>'+
  '<div class="table-scroller"><table class="standing-table"><thead><tr><th>Situazione HT</th><th>G</th><th>V</th><th>N</th><th>P</th></tr></thead><tbody>'+
  row('leading','In vantaggio')+row('drawing','In parità')+row('trailing','In svantaggio')+'</tbody></table></div>'+
  '<p class="subnote">'+E(halftime.sample||0)+' gare con parziale HT verificabile. Non rappresenta una percentuale di tempo.</p></section>';
 return first+scores+half;
}
function gameStatePanels(gameState){
 const g=gameState||{},share=g.stateShare||{},roles=g.roles||{team:{},opponent:{}};
 const pct=v=>!g.matches?'—':Math.round((Number(v)||0)*100)+'%';
 const state='<section class="glass panel"><div class="panel-heading"><h2>Stato della gara</h2></div><div class="team-metric-grid">'+
  cell('Tempo in vantaggio',pct(share.leading))+cell('Tempo in parità',pct(share.drawing))+cell('Tempo in svantaggio',pct(share.trailing))+
  cell('Vantaggi persi',(g.leadsLost||0)+' / '+(g.leadsTaken||0))+cell('Svantaggi recuperati',(g.trailsRecovered||0)+' / '+(g.trailsEntered||0))+
  cell('Risposta entro 10′',g.quickResponsesFor||0)+'</div></section>';
 const labels=[['opener','Apertura (0-0)'],['go_ahead','Gol del sorpasso'],['equalizer','Gol del pareggio'],['deficit_reduction','Accorcia le distanze'],['lead_extension','Allunga il vantaggio']];
 const contexts='<section class="glass panel event-analysis"><div class="panel-heading"><h2>Gol per parziale</h2></div>'+
  '<div class="table-scroller"><table class="standing-table"><thead><tr><th>Tipo di rete</th><th>Fatti</th><th>Subiti</th></tr></thead><tbody>'+
  labels.map(([k,label])=>'<tr><td><b>'+E(label)+'</b></td><td>'+E(roles.team?.[k]||0)+'</td><td>'+E(roles.opponent?.[k]||0)+'</td></tr>').join('')+
  '</tbody></table></div></section>';
 const by=g.byState||{scored:{},conceded:{}};
 const before='<section class="glass panel event-analysis"><div class="panel-heading"><h2>Situazione prima del gol</h2></div>'+
  '<div class="table-scroller"><table class="standing-table"><thead><tr><th>Parziale</th><th>Gol fatti</th><th>Gol subiti</th></tr></thead><tbody>'+
  [['leading','In vantaggio'],['drawing','In parità'],['trailing','In svantaggio']].map(([k,label])=>'<tr><td><b>'+label+'</b></td><td>'+E(by.scored?.[k]||0)+'</td><td>'+E(by.conceded?.[k]||0)+'</td></tr>').join('')+
  '</tbody></table></div></section>';
 return state+contexts+before;
}
function confidenceBadge(level){
 const row=level||{level:'—',label:'n.d.',sample:0};
 return '<span class="eyebrow">CONF. '+E(row.level)+' · '+E(row.label)+' · n='+E(row.sample)+'</span>';
}
function teamProfilePanel(profile){
 const highlights=profileHighlights(profile,6);
 const label=x=>profile.descriptiveKeys?.includes(x.key)?'Caratteristica del gioco':x.value>=.62?'Punto forte':x.value<=.38?'Punto debole':'Profilo neutro';
 const rows=highlights.map(x=>'<tr><td><b>'+E(x.label)+'</b><br><small>'+E(label(x))+'</small></td><td>'+Math.round(Number(x.value)*100)+'</td><td>'+confidenceBadge(profile.confidence?.[x.confidence])+'</td></tr>').join('');
 const confidence='<div class="team-metric-grid">'+
  cell('Dati risultati','A · '+E(profile.confidence?.A?.label||'—'))+
  cell('Timeline gol','B · '+E(profile.confidence?.B?.label||'—'))+
  cell('Eventi specifici','C · '+E(profile.confidence?.C?.label||'—'))+
  cell('Copertura timeline',Math.round((profile.timelineCoverage||0)*100)+'%')+'</div>';
 return '<section class="glass panel event-analysis"><div class="panel-heading"><div><span class="eyebrow">TEAM PROFILE</span><h2>Identità statistica</h2></div></div>'+
  confidence+(rows?'<div class="table-scroller"><table class="standing-table"><thead><tr><th>Indicatore</th><th>Indice</th><th>Attendibilità</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<div class="empty">Campione ancora insufficiente.</div>')+
  '<p class="subnote">Gli indici A usano risultati e calendario; B usa timeline gol complete; C usa eventi più specifici. I livelli meno affidabili pesano meno nel modello.</p></section>';
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
  cell('Gialli',team.yellows)+cell('Blu',team.blues)+cell('Rossi propri',team.reds)+cell('Rossi avversari',team.opponentReds)+cell('Sostituzioni',team.substitutions)+'</div></section>';
 return cards;
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

export function eventDetailStatisticsPanel(events,{playerId=null,side='team'}={}){
 const data=aggregateEventDetails(events,{playerId,side});
 const groups=DETAIL_METRICS.map(([key,title,options])=>{
  const item=data.groups[key];
  if(!item.known)return '';
  return '<div class="event-detail-stat-group"><h3>'+E(title)+' <small>'+item.known+'/'+item.total+' compilati</small></h3>'+
   '<div class="team-metric-grid">'+options.filter(([code])=>item.counts[code]>0).map(([code,label])=>cell(label,item.counts[code])).join('')+'</div></div>';
 }).filter(Boolean).join('');
 if(!groups)return '<p class="subnote">Nessun dettaglio aggiuntivo compilato negli eventi confermati.</p>';
 return groups+'<p class="subnote">Conteggi riferiti ai soli eventi ufficiali o confermati. I dettagli mancanti non sono considerati osservazioni. I gol restano conteggiati dalle fonti ufficiali.</p>';
}
function renderTeamAnalytics(fixtures,matches,events,team,competitions=[],playerStats=[],opponents=[],matchPlayers=[],venues=[],predictionSnapshots=[],history=[]){
 // These are already reconciled seasonal facts; never create a second independent minute total.
 const computedPlayers=playerStats||[];
 const numbers=seasonNumbers(fixtures,matches,events,team,competitions,computedPlayers);
 const coverage=eventCoverage(fixtures,matches,events,team,competitions);
 const intelligence=analyseResults(fixtures,team?.id?'team:'+team.id:null,{competitions,venues,predictionSnapshots,history});
 const specificEventMatches=new Set(verifiedEvents(events).filter(e=>['yellow_card','red_card','second_yellow','blue_card'].includes(e.event_type)).map(e=>e.match_id)).size;
 const profile=buildTeamProfile({numbers,gameState:coverage.gameState,eventMatches:specificEventMatches,resultAnalysis:intelligence});
 const validated=verifiedEvents(events);
 const proposed=(events||[]).filter(e=>e.validation_status==='proposed').length;
 const diff=numbers.gf-numbers.ga;
 const header='<section class="glass panel stats-intro"><div><span class="eyebrow">STAGIONE IN NUMERI</span><h2>'+numbers.gf+
  ' gol segnati <span>/</span> '+numbers.ga+' subiti</h2><p>'+numbers.played+' gare concluse con risultato valido</p></div></section>';
 const core='<div class="team-metric-grid">'+cell('Partite',numbers.played)+cell('Gol fatti',numbers.gf)+cell('Gol subiti',numbers.ga)+
  cell('Differenza reti',(diff>0?'+':'')+diff)+cell('Porte inviolate',numbers.cleanSheets)+cell('Sostituzioni',numbers.substitutions)+'</div>';
 const fullGoalCoverage=coverage.complete===coverage.possible;
 const period='<section class="glass panel"><div class="panel-heading"><h2>Gol per tempo</h2></div><div class="team-metric-grid">'+
  cell('1° tempo',fullGoalCoverage?numbers.goalsByPeriod[0]:'—')+cell('2° tempo',fullGoalCoverage?numbers.goalsByPeriod[1]:'—')+
  cell('Subiti 1° tempo',fullGoalCoverage?numbers.concededByPeriod[0]:'—')+cell('Subiti 2° tempo',fullGoalCoverage?numbers.concededByPeriod[1]:'—')+'</div>'+
  (!fullGoalCoverage?'<p class="subnote">Distribuzione disponibile dopo la riconciliazione delle sequenze gol con i risultati ufficiali.</p>':'')+'</section>';
 const advanced='<section class="glass panel event-analysis"><div class="panel-heading"><h2>Copertura eventi</h2></div>'+
  '<div class="team-metric-grid">'+cell('Eventi ufficializzati',validated.length)+cell('Proposte registrate',proposed)+
  cell('Timeline complete',coverage.complete+'/'+coverage.possible)+'</div>'+
  (!coverage.complete?'<p class="subnote">Le metriche sullo stato della gara richiedono la sequenza completa dei gol e vengono calcolate solo sulle timeline riconciliate.</p>':'')+'</section>';
 return header+'<section class="glass panel">'+core+'</section><div class="leaderboard-grid">'+
  balance(numbers)+venue(numbers)+
  (fullGoalCoverage?goalDistribution(numbers):'<section class="glass panel leaderboard"><div class="panel-heading"><h2>Distribuzione gol</h2></div><p class="subnote">Dati in verifica: la ripartizione non copre tutte le partite concluse.</p></section>')+discipline(numbers,computedPlayers)+'</div>'+
  '<section class="glass panel"><div class="panel-heading"><h2>Ultime partite</h2></div>'+lastResults(numbers.matches,opponents)+'</section>'+
  '<section class="glass panel event-detail-statistics"><div class="panel-heading"><h2>Dettagli gol, cartellini e cambi</h2></div>'+eventDetailStatisticsPanel(events,{side:'team'})+'<h3>Eventi avversari · gol subiti e provvedimenti</h3>'+eventDetailStatisticsPanel(events,{side:'opponent'})+'</section>'+teamProfilePanel(profile)+resultProfilePanel(profile)+resultIntelligencePanel(intelligence)+period+gameStatePanels(coverage.gameState)+progressionsPanel(coverage.gameState,coverage.halftime)+advanced+'<p class="subnote">Fonte: partite concluse, tabellini ed eventi registrati. Le metriche sul parziale usano solo timeline complete e riconciliate; gli eventi rifiutati sono esclusi.</p>';
}

export function fixtureEventsPanel(events,competition=null,fixture=null){
 const rows=(events||[]).filter(e=>e.event_type&&['official','community_confirmed'].includes(e.validation_status)).sort((a,b)=>(cumulativeEventMinute(a,competition)??999)-(cumulativeEventMinute(b,competition)??999)||(a.stoppage_minute??0)-(b.stoppage_minute??0));
 if(!rows.length)return '';
 const goals=rows.filter(e=>['goal','penalty_goal','penalty_scored','own_goal'].includes(e.event_type)&&e.payload?.count_score!==false);
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


const plus=v=>v>0?'+'+v:String(v);
function rankingRows(title,players,key,unit=''){
 const usable=[...(players||[])].filter(p=>p?.[key]!=null&&Number.isFinite(Number(p[key]))&&
  (key==='plus_minus_on'||Number(p[key])>0)).sort((a,b)=>Number(b[key])-Number(a[key])||playerName(a).localeCompare(playerName(b),'it'));
 if(!usable.length)return '';
 const max=Math.max(1,...usable.map(x=>Math.abs(Number(x[key]))));
 return '<section class="stats-player-ranking"><h3>'+E(title)+'</h3><div class="stats-rank-rows">'+usable.map((p,i)=>
  '<div class="stats-rank-row"><span>'+String(i+1).padStart(2,'0')+'</span><strong>'+E(playerName(p))+'</strong>'+
  '<div class="stats-rank-track"><i style="width:'+Math.round(Math.abs(Number(p[key]))/max*100)+'%"></i></div>'+
  '<b>'+E(key==='plus_minus_on'?plus(Number(p[key])):Number(p[key]).toLocaleString('it-IT',{maximumFractionDigits:2}))+E(unit)+'</b></div>').join('')+'</div></section>';
}
function playersNumbers(players,impacts=[],ratings=[],comparisons=[],events=[],mvpCounts=new Map()){
 const impactMap=new Map(impacts.map(x=>[String(x.player_id),x])),ratingMap=new Map(ratings.map(x=>[String(x.player_id),x]));
 const merged=(comparisons.length?comparisons:players.map(p=>({...p,...impactMap.get(String(p.player_id)),...ratingMap.get(String(p.player_id))}))).map(p=>({...p,mvp_awards:mvpCounts.get(String(p.player_id))||0}));
 const groups=[
 ['usage','Impiego',[['Presenze','appearances'],['Minuti','minutes'],['Subentri','subentries'],
  ['Minuti per presenza','minutes_per_appearance'],['Titolarità %','start_rate']]],
 ['attack','Attacco',[['Gol','goals'],['Assist','assists'],['Gol / 80′','goals_per_80'],
  ['Assist / 80′','assists_per_80'],['Gol del pareggio','equalizers'],
  ['Gol del vantaggio','go_ahead_goals'],['Porta al +1','goals_to_plus_1'],
  ['Porta al +2','goals_to_plus_2'],['Porta al +3 o più','goals_to_plus_3'],
  ['Gol che riducono il distacco','deficit_reducers'],['Gol sotto nel punteggio','trailing_goals'],
  ['Pareggi in rimonta','comeback_equalizers'],['Vantaggi in rimonta','comeback_go_ahead_goals'],
  ['Ampliano il vantaggio','lead_extenders']]],
 ['impact','Impatto',[['GF in campo','goals_for_on'],['GS in campo','goals_against_on'],
  ['Plus/minus','plus_minus_on'],['GF / 80′','gf_on_per_80'],
  ['GS / 80′','ga_on_per_80'],['+/- / 80′','plus_minus_per_80']]],
 ['rating','Rating',[['MVP','mvp_awards'],['Media voto','avg_rating'],['Gare valutate','rated_matches'],
  ['Voti ricevuti','votes_received'],['Gare ≥7','high_rating_games'],
  ['Gare <6','low_rating_games'],['Voto massimo','highest_rating'],
  ['Voto minimo','lowest_rating'],['Variabilità','rating_volatility']]],
 ['discipline','Disciplina',[['Ammonizioni','yellow_cards'],['Espulsioni','red_cards'],
  ['Cartellini totali','disciplinary_cards']]]
 ];
 const tabs='<div class="stats-ranking-tabs" role="tablist" aria-label="Tipo statistiche giocatore">'+groups.map(([id,title],i)=>
 '<button type="button" data-stats-ranking="'+id+'" role="tab" aria-selected="'+(i===0)+'">'+E(title)+'</button>').join('')+'</div>';
 const panels=groups.map(([id,title,metrics],i)=>
 '<div class="stats-player-grid" data-stats-ranking-panel="'+id+'"'+(i?' hidden':'')+'>'+
 metrics.map(([metric,key])=>rankingRows(metric,merged,key)).filter(Boolean).join('')+'</div>').join('');
 const detailGroups=DETAIL_METRICS.map(([key,title,options])=>{
  const values=merged.map(p=>{
   const detail=aggregateEventDetails(events,{playerId:p.player_id,side:'team'}).groups[key];
   return {...p,event_detail_value:detail.known,detail_counts:detail.counts};
  });
  return options.map(([code,label])=>rankingRows(title+' · '+label,values.map(v=>({...v,event_detail_value:v.detail_counts[code]})),'event_detail_value')).filter(Boolean).join('');
 }).filter(Boolean).join('');
 return '<div class="stats-player-section"><p class="stats-hint">Confronti stagionali dei giocatori Caselle · dati certificati nella vista SQL unica. Le voci senza dati sono omesse.</p>'+
 tabs+panels+'<section class="stats-player-detail-block"><h3>Dettagli eventi · confronti giocatori</h3>'+detailGroups+'</section></div>';
}

function extendedTournamentNumbers(fixtures,teamComparisons,fixtureEvents=[],team=null,opponents=[]){
 const finished=(fixtures||[]).filter(f=>f.status==='finished'&&!f.is_test&&Number.isInteger(Number(f.home_score))&&Number.isInteger(Number(f.away_score)));
 const ids=new Set(finished.map(f=>String(f.id)));
 const valid=fixtureEvents.filter(e=>ids.has(String(e.fixture_id))&&['official','community_confirmed'].includes(e.validation_status));
 const byFixture=new Map();for(const e of valid){const k=String(e.fixture_id);if(!byFixture.has(k))byFixture.set(k,[]);byFixture.get(k).push(e)}
 const rows=new Map();
 const label=(id,local)=>local?.id===id?local.name:(opponents||[]).find(o=>o.id===id)?.name||null;
 const update=(competition_id,name,home,gf,ga,f)=>{
  const key=String(competition_id)+'|'+name.toLocaleLowerCase('it');let r=rows.get(key);
  if(!r){r={competition_id,name,played:0,wins:0,draws:0,losses:0,gf:0,ga:0,home:0,away:0,verified:0,ordered:0,timed:0,yellows:0,reds:0,blues:0,changes:0,cardGames:0,changeGames:0,goalsFirst:0,goalsLast:0,comebackPoints:0,leadLost:0,fromBehind:0,fromAhead:0,homeWins:0,homeDraws:0,homeLosses:0,awayWins:0,awayDraws:0,awayLosses:0};rows.set(key,r)}
  r.played++;r.gf+=gf;r.ga+=ga;r[gf>ga?'wins':gf<ga?'losses':'draws']++;r[home?'home':'away']++;
  r[(home?'home':'away')+(gf>ga?'Wins':gf===ga?'Draws':'Losses')]++;
  const events=byFixture.get(String(f.id))||[];
  const side=home?'home':'away';
  const teamHome=Boolean(f.home_team_id),teamAway=Boolean(f.away_team_id);
  const normalizedSide=e=>e.team_side==='team'?(teamHome?'home':teamAway?'away':null):e.team_side==='opponent'?(teamHome?'away':teamAway?'home':null):e.team_side;
  const card=events.filter(e=>normalizedSide(e)===side&&['yellow_card','red_card','second_yellow','blue_card'].includes(e.event_type));
  const changes=events.filter(e=>normalizedSide(e)===side&&e.event_type==='substitution');
  r.yellows+=card.filter(e=>e.event_type==='yellow_card').length;r.reds+=card.filter(e=>['red_card','second_yellow'].includes(e.event_type)).length;r.blues+=card.filter(e=>e.event_type==='blue_card').length;r.changes+=changes.length;
  if(events.length){r.cardGames++;r.changeGames++}
  const goals=events.filter(e=>['goal','own_goal','penalty_goal','penalty_scored'].includes(e.event_type)&&e.payload?.count_score!==false);
  const scoreSide=e=>e.event_type==='own_goal'?(normalizedSide(e)==='home'?'away':'home'):normalizedSide(e);
  if(goals.length!==Number(f.home_score)+Number(f.away_score)||goals.some(e=>!['home','away'].includes(scoreSide(e)))||goals.filter(e=>scoreSide(e)==='home').length!==Number(f.home_score)||goals.filter(e=>scoreSide(e)==='away').length!==Number(f.away_score))return;
  r.verified++;
  const canTime=goals.every(e=>Number.isInteger(e.minute));if(canTime)r.timed++;
  // No chronological inference from created_at: upload order is not match event order.
  const ordered=goals.every(e=>Number.isInteger(Number(e.payload?.sequence_order??e.payload?.event_order??e.source_raw?.sequence_order)));
  if(ordered||canTime){
   // Ordered score slots are suitable for score progression, not minute-based shares.
   const orderedGoals=[...goals].sort((a,b)=>{
    const order=e=>Number(e.payload?.sequence_order??e.payload?.event_order??e.source_raw?.sequence_order);
    if(ordered)return order(a)-order(b);
    return Number(a.minute)-Number(b.minute)||Number(a.stoppage_minute||0)-Number(b.stoppage_minute||0);
   });
   const indexes=orderedGoals.map(e=>ordered?Number(e.payload?.sequence_order??e.payload?.event_order??e.source_raw?.sequence_order):Number(e.minute)*100+Number(e.stoppage_minute||0));
   if(new Set(indexes).size===indexes.length){
    r.ordered++;
    let us=0,them=0,wasAhead=false,wasBehind=false;
    for(const goal of orderedGoals){
     if(us>them)wasAhead=true;if(us<them)wasBehind=true;
     if(scoreSide(goal)===side)us++;else them++;
    }
    if(wasBehind){r.fromBehind++;if(gf>=ga)r.comebackPoints++}
    if(wasAhead){r.fromAhead++;if(gf<=ga)r.leadLost++}
   }
  }
 };
 for(const f of finished){const h=label(f.home_team_id,team)||label(f.home_opponent_id,team)||f.home_team;const a=label(f.away_team_id,team)||label(f.away_opponent_id,team)||f.away_team;if(h)update(f.competition_id,String(h),true,Number(f.home_score),Number(f.away_score),f);if(a)update(f.competition_id,String(a),false,Number(f.away_score),Number(f.home_score),f)}
 const all=[...rows.values()].sort((a,b)=>a.name.localeCompare(b.name,'it'));
 if(!all.length)return '<p class="stats-hint">Non ci sono risultati ufficiali disponibili.</p>';
 const fmt=v=>v==null?'—':Number(v).toLocaleString('it-IT',{maximumFractionDigits:2});
 const blocks=[
  ['results','Bilancio',[
   ['Vittorie','wins','',false],['Gol fatti','gf','',false],['Gol subiti','ga','',false],
   ['Vittorie in casa','homeWins','',false],['Vittorie in trasferta','awayWins','',false]]],
  ['progress','Andamento',[
   ['Partite in rimonta con punti','comebackPoints','',true],['Vantaggio non conservato','leadLost','',true],
   ['Partite sotto nel punteggio','fromBehind','',true],['Partite sopra nel punteggio','fromAhead','',true]]],
  ['discipline','Disciplina e cambi',[
   ['Cartellini gialli','yellows','',true],['Cartellini rossi','reds','',true],
   ['Cartellini blu','blues','',true],['Sostituzioni','changes','',true],
   ['Cambi per gara documentata',r=>r.changeGames?r.changes/r.changeGames:null,'',true]]],
  ['coverage','Affidabilità',[['Partite con gol verificati','verified','',false],
    ['Progressione gol ordinata','ordered','',false],['Timeline con minuti','timed','',false]]]
 ];
 const competitions=[...new Set(all.map(x=>String(x.competition_id)))];
 const panel=(comp,index)=>{
  const teams=all.filter(x=>String(x.competition_id)===comp);
  // Competition label is displayed through the dedicated tournament selector when required.
  const groups=blocks.map(([id,label,metrics],groupIndex)=>
   '<div class="stats-insights-panel" data-extended-metric-panel="'+id+'"'+(groupIndex?' hidden':'')+'>'+
   '<div class="stats-insights-grid">'+metrics.map(([name,key,unit,requiresEvents])=>{
    const eligible=teams.filter(t=>!requiresEvents||t.cardGames>0||['fromBehind','fromAhead','comebackPoints','leadLost'].includes(key)&&t.ordered>0)
     .map(t=>({...t,metric:typeof key==='function'?key(t):t[key]}))
     .filter(t=>t.metric!==null&&Number.isFinite(Number(t.metric)))
     .sort((a,b)=>Number(b.metric)-Number(a.metric)||a.name.localeCompare(b.name,'it'));
    if(!eligible.length)return '<article class="stats-insight"><h4>'+E(name)+'</h4><p class="stats-insight-empty">Dati insufficienti</p></article>';
    const max=Math.max(1,...eligible.map(t=>Math.abs(Number(t.metric))));
    return '<article class="stats-insight"><h4>'+E(name)+'</h4><div class="stats-insight-rows">'+eligible.map((t,i)=>
     '<div class="stats-insight-row"><span class="stats-insight-pos">'+String(i+1).padStart(2,'0')+'</span>'+
     '<strong title="'+E(t.name)+'">'+E(t.name)+'</strong><div class="stats-insight-track"><span style="width:'+
     (Math.abs(Number(t.metric))/max*100).toFixed(1)+'%"></span></div><b>'+E(fmt(t.metric)+unit)+'</b></div>').join('')+
     '</div></article>';
   }).join('')+'</div></div>').join('');
  return '<div data-extended-comp-panel="'+E(comp)+'"'+(index?' hidden':'')+'>'+
   '<nav class="stats-insights-nav" aria-label="Categoria confronto squadre">'+blocks.map(([key,label],i)=>
   '<button type="button" data-extended-metric="'+key+'" aria-pressed="'+(i===0)+'">'+E(label)+'</button>').join('')+'</nav>'+
   groups+'</div>';
 };
 return '<section class="stats-insights" aria-label="Analisi squadre avversarie">'+
  '<div class="stats-insights-header"><div><span class="eyebrow">ANALISI COMPARATA</span><h2>Le squadre, oltre la classifica.</h2>'+
  '<p>Rendimento, andamento, disciplina e affidabilità dei dati. Un confronto alla volta.</p></div>'+
  '<div class="stats-insights-summary"><strong>'+all.length+'</strong><small>squadre analizzate</small></div></div>'+
  (competitions.length>1?'<nav class="stats-insights-competitions" aria-label="Torneo confronto">'+competitions.map((id,i)=>
    '<button type="button" data-extended-comp="'+E(id)+'" aria-pressed="'+(i===0)+'">'+
    E(id)+'</button>').join('')+'</nav>':'')+
  competitions.map(panel).join('')+
  '<footer class="stats-insights-foot">Esiti: risultati ufficiali. Progressioni: solo gol con ordine univoco; senza minuto non sono attribuite durate. Eventi disciplinari e cambi: dati confermati disponibili, non necessariamente tabellini completi.</footer></section>';
}
function tournamentNumbers(fixtures,competitions,flowRows=[],phaseRows=[],eventContexts=[],opponentFlows=[],teamComparisons=[],fixtureEvents=[],team=null,opponents=[]){
 const groups=[
  ['states','Stato del risultato',[['% in vantaggio','lead_pct','%'],['% in svantaggio','trail_pct','%'],
    ['% sullo 0-0','nil_pct','%'],['Minuti in vantaggio','leading_minutes','′'],['Minuti in svantaggio','trailing_minutes','′'],
    ['Minuti sullo 0-0','nil_minutes','′'],['Parità dopo i gol','scored_draw_minutes','′']]],
  ['changes','Rimonte e vantaggi',[['Pareggi in rimonta','comeback_equalizers',''],
    ['Vantaggi conquistati','leads_taken','']]],
  ['coverage','Copertura',[['Gare con timeline verificata','verified_games',''],
    ['Gare non verificabili','missing_games','']]]
 ];
 const comps=[...new Set(teamComparisons.map(r=>String(r.competition_id)))];
 const scopes=comps.map((id,index)=>{
  const rows=teamComparisons.filter(r=>String(r.competition_id)===id);
  const name=competitions.find(c=>String(c.id)===id)?.name||'Competizione';
  const metricPanels=groups.map(([group,title,items],gi)=>'<section data-team-metric-panel="'+group+'"'+(gi?' hidden':'')+'>'+
   '<div class="stats-team-ranking-grid">'+items.map(([label,key,unit])=>{
    const available=rows.filter(t=>Number(t.verified_games)>0||key==='verified_games'||key==='missing_games')
     .filter(t=>t[key]!==null&&t[key]!==undefined&&Number.isFinite(Number(t[key])))
     .sort((x,y)=>Number(y[key])-Number(x[key])||String(x.team_name).localeCompare(String(y.team_name),'it'));
    if(!available.length)return '';
    const peak=Math.max(1,...available.map(t=>Math.abs(Number(t[key]))));
    return '<section class="stats-player-ranking"><h3>'+E(label)+'</h3><div class="stats-rank-rows">'+available.map((t,i)=>
     '<div class="stats-rank-row" title="'+E(t.verified_games+' / '+t.played+' gare verificate')+'"><span>'+String(i+1).padStart(2,'0')+'</span>'+
     '<strong>'+E(t.team_name)+'</strong><div class="stats-rank-track"><i style="width:'+(Math.abs(Number(t[key]))/peak*100).toFixed(1)+'%"></i></div>'+
     '<b>'+E(Number(t[key]).toLocaleString('it-IT',{maximumFractionDigits:2})+unit)+'</b></div>').join('')+'</div></section>';
   }).join('')+'</div></section>').join('');
  return '<section data-team-comp-panel="'+E(id)+'"'+(index?' hidden':'')+'><p class="stats-hint">Confronto tra tutte le squadre del torneo. Percentuali calcolate solo sui minuti verificati. Passa sui nomi per vedere la copertura delle partite; i dati assenti non diventano zero.</p>'+
   '<div class="stats-ranking-tabs" role="tablist" aria-label="Confronto squadra">'+groups.map(([key,title],i)=>
   '<button data-team-metric="'+key+'" role="tab" type="button" aria-selected="'+(i===0)+'">'+E(title)+'</button>').join('')+'</div>'+
   metricPanels+'</section>';
 }).join('');
 return '<div class="stats-tournament-section"><p class="stats-hint">Andamento delle partite per squadra · non una seconda classifica del campionato.</p>'+
  (comps.length>1?'<div class="stats-ranking-tabs" role="tablist" aria-label="Competizione">'+comps.map((id,i)=>
   '<button data-team-comp="'+E(id)+'" role="tab" type="button" aria-selected="'+(i===0)+'">'+
   E(competitions.find(c=>String(c.id)===id)?.name||'Competizione')+'</button>').join('')+'</div>':'')+
  (scopes||'<p class="stats-hint">Dati verificati non ancora disponibili.</p>')+extendedTournamentNumbers(fixtures,teamComparisons,fixtureEvents,team,opponents)+
  '<p class="stats-hint">“Pressione” e “sofferenza” indicano solamente condizioni del punteggio; non misurano azioni o possesso.</p></div>';
}
export function renderEventAnalytics(fixtures,matches,events,team,competitions=[],playerStats=[],opponents=[],matchPlayers=[],venues=[],predictionSnapshots=[],history=[],goalImpacts=[],ratingInsights=[],playerComparisons=[],matchFlows=[],flowPhases=[],flowEventContexts=[],opponentFlows=[],teamComparisons=[],mvpCounts=new Map(),fixtureEvents=[]){
 const tabs='<nav class="stats-scope-tabs" role="tablist" aria-label="Ambito delle statistiche">'+
 [['team','Squadra · Caselle'],['players','Giocatori · Caselle'],['all','Complessivo · Torneo']].map(([id,label],i)=>
 '<button type="button" role="tab" data-stats-scope="'+id+'" aria-selected="'+(i===0)+'">'+E(label)+'</button>').join('')+'</nav>';
 return tabs+'<div class="stats-scope-panel" data-stats-panel="team">'+
 renderTeamAnalytics(fixtures,matches,events,team,competitions,playerStats,opponents,matchPlayers,venues,predictionSnapshots,history)+
 '</div><div class="stats-scope-panel" data-stats-panel="players" hidden>'+playersNumbers(playerStats,goalImpacts,ratingInsights,playerComparisons,events,mvpCounts)+
 '</div><div class="stats-scope-panel" data-stats-panel="all" hidden>'+tournamentNumbers(fixtures,competitions,matchFlows,flowPhases,flowEventContexts,opponentFlows,teamComparisons,fixtureEvents,team,opponents)+'</div>';
}
