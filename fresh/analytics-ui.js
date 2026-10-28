import {playerStintPoints} from './player-stint-points.js';
import {enrichPlayerNumbers} from './stat-rates.js?v=20261029rates1';
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

/* One metric, one home: the Caselle dashboard owns results, flow, goals, discipline and context. */
const statN=(value,d=0)=>value==null||!Number.isFinite(Number(value))?'—':Number(value).toLocaleString('it-IT',{maximumFractionDigits:d});
const statPct=v=>v==null||!Number.isFinite(Number(v))?'—':statN(Number(v)*100,0)+'%';
const statGlyph=type=>{
 const paths={
  result:'<path d="M4 12h16M12 4v16"/><circle cx="12" cy="12" r="9"/>',
  goal:'<circle cx="12" cy="12" r="9"/><path d="m12 5 4 3-1.5 5H9.5L8 8zM3 11l6 2m6 0 6-2m-7 8-2-6m-2 0-2 6"/>',
  form:'<path d="m3 16 6-6 4 4 8-9M16 5h5v5"/>',
  cards:'<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M9 8h6"/>',
  field:'<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M12 4v16"/><circle cx="12" cy="12" r="3"/>',
  data:'<path d="M4 20V9m5 11V4m5 16v-7m5 7v-12"/>'
 };
 return '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[type]||paths.data)+'</svg>';
};
const statTile=(label,value,icon,detail='')=>'<div class="tm-analytics-kpi"><span class="tm-analytics-kpi-icon">'+statGlyph(icon)+'</span><strong>'+E(value)+'</strong><span>'+E(label)+'</span>'+(detail?'<small>'+E(detail)+'</small>':'')+'</div>';
const statSection=(title,body,description='')=>'<section class="tm-analytics-feature"><div class="tm-analytics-section-head"><h3>'+E(title)+'</h3>'+(description?'<span>'+E(description)+'</span>':'')+'</div>'+body+'</section>';
const statValue=(label,value)=>'<div class="tm-analytics-small"><span>'+E(label)+'</span><b>'+E(value)+'</b></div>';
function renderTeamAnalytics(fixtures,matches,events,team,competitions=[],playerStats=[],opponents=[],matchPlayers=[],venues=[],predictionSnapshots=[],history=[]){
 const numbers=seasonNumbers(fixtures,matches,events,team,competitions,playerStats||[]);
 const coverage=eventCoverage(fixtures,matches,events,team,competitions);
 const intelligence=analyseResults(fixtures,team?.id?'team:'+team.id:null,{competitions,venues,predictionSnapshots,history});
 const confirmed=verifiedEvents(events);
 const profile=buildTeamProfile({numbers,gameState:coverage.gameState,
  eventMatches:new Set(confirmed.filter(e=>['yellow_card','red_card','second_yellow','blue_card'].includes(e.event_type)).map(e=>e.match_id)).size,
  resultAnalysis:intelligence});
 const games=Math.max(0,Number(numbers.played)||0),goalsComplete=coverage.complete===coverage.possible&&coverage.possible>0;
 const left=(a,b)=>!a&&!b?0:Math.round(100*a/(a+b));
 const snapshot='<div class="tm-analytics-kpis">'+
  statTile('Partite',statN(games),'field')+statTile('Vittorie',statN(numbers.wins),'result')+
  statTile('Pareggi',statN(numbers.draws),'result')+statTile('Sconfitte',statN(numbers.losses),'result')+
  statTile('Gol fatti',statN(numbers.gf),'goal')+statTile('Gol subiti',statN(numbers.ga),'goal')+
  statTile('Differenza reti',(numbers.gf-numbers.ga>0?'+':'')+statN(numbers.gf-numbers.ga),'form')+
  statTile('Porte inviolate',statN(numbers.cleanSheets),'field')+'</div>'+
  statSection('Bilancio della stagione','<div class="tm-analytics-scorebar" role="img" aria-label="Vittorie '+numbers.wins+', pareggi '+numbers.draws+', sconfitte '+numbers.losses+'">'+
   '<i class="win" style="width:'+(games?100*numbers.wins/games:0)+'%"></i><i class="draw" style="width:'+(games?100*numbers.draws/games:0)+'%"></i><i class="loss" style="width:'+(games?100*numbers.losses/games:0)+'%"></i></div>'+
   '<div class="tm-analytics-legend"><span><i class="win"></i> Vittorie</span><span><i class="draw"></i> Pareggi</span><span><i class="loss"></i> Sconfitte</span></div>')+
  statSection('Ultimi risultati',lastResults(numbers.matches,opponents));
 const gs=coverage.gameState||{},state=gs.stateShare||{},timed=Number(gs.matches)||0;
 const leadPct=timed?Math.max(0,Math.min(100,100*(Number(state.leading)||0))):0;
 const drawPct=timed?Math.max(0,Math.min(100-leadPct,100*(Number(state.drawing)||0))):0;
 const flowDonut=timed?
  '<div class="tm-analytics-donut-layout"><div class="tm-analytics-donut" role="img" aria-label="Tempo in vantaggio '+Math.round(leadPct)+'%, in parità '+Math.round(drawPct)+'%, in svantaggio '+Math.round(Math.max(0,100-leadPct-drawPct))+'%" style="--lead:'+leadPct+'%;--draw:'+(leadPct+drawPct)+'%"><div><b>'+timed+'</b><small>gare</small></div></div>'+
  '<div class="tm-analytics-donut-legend">'+[['In vantaggio',leadPct,'win'],['In parità',drawPct,'draw'],['In svantaggio',Math.max(0,100-leadPct-drawPct),'loss']].map(([name,p,cl])=>'<div><i class="'+cl+'"></i><span>'+name+'</span><b>'+statN(p)+'%</b></div>').join('')+'</div></div>':
  '<p class="tm-analytics-empty">Non ci sono minuti verificati per questo grafico.</p>';
 const firstGoals=coverage.gameState||{},fh=coverage.halftime||{};
 const timingKpis='<div class="tm-analytics-statgrid">'+
  statValue('Vantaggi persi',timed?statN(gs.leadsLost)+' / '+statN(gs.leadsTaken):'—')+
  statValue('Svantaggi recuperati',timed?statN(gs.trailsRecovered)+' / '+statN(gs.trailsEntered):'—')+
  statValue('Risposte entro 10′',timed?statN(gs.quickResponsesFor):'—')+'</div>';
 const halfRows=[['In vantaggio',fh.leading],['In parità',fh.drawing],['In svantaggio',fh.trailing]];
 const halfMatrix=(Number(fh.sample)||0)?
   '<div class="tm-analytics-matrix"><div class="tm-analytics-matrix-head"><span>Intervallo → finale</span><span>V</span><span>N</span><span>P</span></div>'+
   halfRows.map(([label,row])=>'<div class="tm-analytics-matrix-row"><b>'+E(label)+'</b>'+
    ['wins','draws','losses'].map(k=>'<span style="--heat:'+(row?.matches?Math.max(0,Math.min(1,(Number(row[k])||0)/row.matches)):0)+'" title="'+E(label+': '+(row?.[k]||0)+' gare')+'">'+statN(row?.[k]||0)+'</span>').join('')+'</div>').join('')+'</div>'+
    '<p class="tm-analytics-note">Campione: '+statN(fh.sample)+' gare con parziale all’intervallo verificabile.</p>':
   '<p class="tm-analytics-empty">Nessun parziale HT verificabile.</p>';
 const progression=Object.entries(gs.progressions||{}).flatMap(([side,x])=>Object.entries(x||{}).map(([step,count])=>({side,step,count:Number(count)||0}))).filter(x=>x.count>0).sort((a,b)=>b.count-a.count).slice(0,6);
 const progressionMarkup=progression.length?
  '<div class="tm-analytics-progression">'+progression.map(x=>'<div><span>'+E(x.step.replace(/-/g,' → '))+'</span><small>'+E(x.side==='team'?'Caselle':'Avversaria')+'</small><b>'+statN(x.count)+'</b></div>').join('')+'</div>':
  '<p class="tm-analytics-empty">Sequenze del punteggio non ancora disponibili.</p>';
 const flow=statSection('Tempo nelle situazioni di gara',flowDonut,'Solo timeline temporali verificate')+
  statSection('Gestione dei vantaggi e delle rimonte',timingKpis)+
  '<div class="tm-analytics-two">'+statSection('Intervallo → risultato',halfMatrix)+statSection('Passaggi di punteggio più frequenti',progressionMarkup)+'</div>';
 const periods=[
  {label:'1° tempo',gf:goalsComplete?Number(numbers.goalsByPeriod?.[0])||0:null,ga:goalsComplete?Number(numbers.concededByPeriod?.[0])||0:null},
  {label:'2° tempo',gf:goalsComplete?Number(numbers.goalsByPeriod?.[1])||0:null,ga:goalsComplete?Number(numbers.concededByPeriod?.[1])||0:null}
 ];
 const peak=Math.max(1,...periods.flatMap(x=>[x.gf||0,x.ga||0]));
 const goalChart=goalsComplete?'<div class="tm-analytics-paired">'+periods.map(p=>
  '<div class="tm-analytics-paired-row"><h4>'+E(p.label)+'</h4><div class="tm-analytics-paired-bars">'+
   '<div><span class="tm-analytics-paired-track"><i class="for" style="width:'+(p.gf/peak*100)+'%"></i></span><b>'+statN(p.gf)+'</b><small>Fatti</small></div>'+
   '<div><span class="tm-analytics-paired-track"><i class="against" style="width:'+(p.ga/peak*100)+'%"></i></span><b>'+statN(p.ga)+'</b><small>Subiti</small></div>'+
   '</div></div>').join('')+'</div>':
  '<p class="tm-analytics-empty">Distribuzione dei gol non ancora completamente riconciliata.</p>';
 const goals=statSection('Produzione per tempo',goalChart,'Gol fatti / subiti')+
  statSection('Come nascono i gol',eventDetailStatisticsPanel(events,{side:'team'}),'Eventi con dettagli compilati')+
  statSection('Come vengono subiti',eventDetailStatisticsPanel(events,{side:'opponent'}),'Eventi avversari confermati');
 const hasCards=confirmed.some(e=>['yellow_card','red_card','second_yellow','blue_card','substitution'].includes(e.event_type));
 const discipline='<div class="tm-analytics-kpis">'+
  statTile('Ammonizioni',hasCards?statN(numbers.yellows):'—','cards')+
  statTile('Espulsioni',hasCards?statN(numbers.reds):'—','cards')+
  statTile('Cartellini blu',hasCards?statN(numbers.blues):'—','cards')+
  statTile('Rossi avversari',hasCards?statN(numbers.opponentReds):'—','cards')+
  statTile('Sostituzioni',hasCards?statN(numbers.substitutions):'—','form')+'</div>'+
  '<p class="tm-analytics-note">Eventi registrati e confermati; l’assenza di un evento non dimostra che non sia avvenuto.</p>';
 const n2=x=>x==null||!Number.isFinite(Number(x))?'—':statN(x,2);
 const venueRows=[['Casa',intelligence.venue?.home],['Trasferta',intelligence.venue?.away],
  ...(intelligence.venue?.bySurface||[]).filter(x=>x.matches>=2).map(x=>[x.label,x])];
 const contextVenues='<div class="tm-analytics-context-list">'+venueRows.map(([name,r])=>
  '<div class="tm-analytics-context-row"><strong>'+E(name)+'</strong><span>'+statN(r?.matches||0)+' gare</span>'+
  '<b>'+n2(r?.ppg)+' <small>pt/g</small></b><span>'+n2(r?.gfpg)+' / '+n2(r?.gapg)+' <small>GF/GS</small></span></div>').join('')+'</div>';
 const tiers=[['Superiore','higher'],['Simile','similar'],['Inferiore','lower']];
 const contextRanks='<div class="tm-analytics-context-list">'+tiers.map(([name,key])=>{
  const x=intelligence.opponentTier?.[key];
  return '<div class="tm-analytics-context-row"><strong>'+name+'</strong><span>'+statN(x?.matches||0)+' gare</span><b>'+n2(x?.ppg)+' <small>pt/g</small></b><span>'+n2(x?.gfpg)+' / '+n2(x?.gapg)+' <small>GF/GS</small></span></div>';
 }).join('')+'</div>';
 const context='<div class="tm-analytics-two">'+statSection('Casa, trasferta e terreno',contextVenues)+
  statSection('Rendimento per forza avversaria',contextRanks)+'</div>'+
  (intelligence.vsPrediction?.matches?statSection('Risultato rispetto alle attese',statTile('Differenza punti',((intelligence.vsPrediction.delta||0)>0?'+':'')+n2(intelligence.vsPrediction.delta),'form',statN(intelligence.vsPrediction.matches)+' partite con pronostico pre-gara')):'');
 const highlights=profileHighlights(profile,8).filter(x=>x.key!=='protect-multi-goal').slice(0,5);
 const identity=statSection('Tratti distintivi della squadra',
   highlights.length?'<div class="tm-analytics-identities">'+highlights.map(x=>
    '<div><div class="tm-analytics-identity-title"><strong>'+E(x.label)+'</strong><b>'+statPct(x.value)+'</b></div>'+
    '<div class="tm-analytics-identity-track"><span style="width:'+Math.max(0,Math.min(100,100*Number(x.value)))+'%"></span></div>'+
    '<small>Campione '+statN(x.sample)+' · fonte '+E(x.confidence)+'</small></div>').join('')+'</div>':
    '<p class="tm-analytics-empty">Campione ancora insufficiente per il profilo.</p>')+
  (intelligence.strength?.index!=null?statSection('Forza stimata',statTile('Indice attuale',statN(intelligence.strength.index,1),'form',
   'Variazione ultime 5: '+(intelligence.strength.deltaFive>0?'+':'')+statN(intelligence.strength.deltaFive,1))):'');
 const sections=[
  ['snapshot','Panoramica',statGlyph('result'),snapshot],
  ['flow','Andamento',statGlyph('form'),flow],
  ['goals','Gol',statGlyph('goal'),goals],
  ['discipline','Disciplina e cambi',statGlyph('cards'),discipline],
  ['context','Contesto',statGlyph('field'),context],
  ['identity','Identità',statGlyph('data'),identity]
 ];
 return '<div class="tm-analytics-dashboard">'+
  '<header class="tm-analytics-header"><span class="eyebrow">TEAM INTELLIGENCE · '+E(team?.name||'CASELLE')+'</span>'+
  '<h2>La stagione, letta sul campo.</h2><p>Risultati, dinamiche e contesto: ogni statistica nel suo posto.</p></header>'+
  '<nav class="tm-analytics-tabs" aria-label="Statistiche Caselle">'+sections.map(([key,name,icon],i)=>
   '<button type="button" data-team-dash="'+key+'" aria-selected="'+(i===0)+'">'+icon+'<span>'+E(name)+'</span></button>').join('')+'</nav>'+
  sections.map(([key,name,icon,body],i)=>'<div data-team-dash-panel="'+key+'"'+(i?' hidden':'')+'>'+body+'</div>').join('')+
  '<footer class="tm-analytics-coverage"><span>Copertura</span><b>'+statN(coverage.complete)+' / '+statN(coverage.possible)+' timeline complete</b><small>Statistiche temporali solo con eventi verificabili</small></footer></div>';
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
 const isDiverging=['plus_minus_on','plus_minus_per_80','stint_points_delta','stint_points_delta_per_80'].includes(key);
 const isDot=['start_rate','avg_rating','rating_volatility','gf_on_per_80','ga_on_per_80'].includes(key);
 const numeric=p=>Number(p?.[key]);
 const usable=[...(players||[])].filter(p=>p?.[key]!=null&&Number.isFinite(numeric(p)))
  .sort((a,b)=>numeric(b)-numeric(a)||playerName(a).localeCompare(playerName(b),'it'));
 if(!usable.length)return '';
 const max=Math.max(1,...usable.map(x=>Math.abs(numeric(x))));
 const vis=isDiverging?'diverging':isDot?'dot':'bar';
 const format=p=>{
  let v=numeric(p);
  if(key==='start_rate')return statN(v<=1?v*100:v,0)+'%';
  if(key==='plus_minus_on'||isDiverging)return (v>0?'+':'')+statN(v,2);
  return statN(v,2)+unit;
 };
 return '<section class="stats-player-ranking" data-rank-vis="'+vis+'"><h3>'+E(title)+'</h3><div class="stats-rank-rows">'+usable.map((p,i)=>{
  const v=numeric(p),percent=Math.min(100,Math.abs(v)/max*100),negative=v<0;
  const style=isDiverging?'width:'+(percent/2).toFixed(1)+'%;left:'+(negative?(50-percent/2).toFixed(1):'50')+'%':
   isDot?'left:'+percent.toFixed(1)+'%':'width:'+percent.toFixed(1)+'%';
  return '<div class="stats-rank-row"><span>'+String(i+1).padStart(2,'0')+'</span><strong title="'+E(playerName(p))+'">'+E(playerName(p))+'</strong>'+
   '<div class="stats-rank-track"><i'+(negative?' class="negative"':'')+' style="'+style+'"></i></div>'+
   '<b>'+E(format(p))+'</b></div>';
 }).join('')+'</div></section>';
}
function playersNumbers(players,impacts=[],ratings=[],comparisons=[],events=[],mvpCounts=new Map(),stintPoints=new Map()){
 const merged=enrichPlayerNumbers(players,comparisons,impacts,ratings,mvpCounts,stintPoints);
 const groups=[
 ['usage','Impiego',[['Presenze','appearances'],['Titolarità','starts'],['Subentri','subentries'],['Minuti','minutes'],
  ['Minuti per presenza','minutes_per_appearance'],['Titolarità %','start_rate'],['Subentri %','subentries_per_game']]],
 ['attack','Attacco',[['Gol','goals'],['Assist','assists'],['Gol + assist','goals_assists'],['Gol / gara','goals_per_game'],['Assist / gara','assists_per_game'],['Gol + assist / gara','goals_assists_per_game'],['Gol / 80′','goals_per_80'],['Assist / 80′','assists_per_80'],['Gol + assist / 80′','goals_assists_per_80']]],
 ['goal-impact','Valore dei gol',[
  ['Gol del pareggio','equalizers'],['Gol del vantaggio','go_ahead_goals'],['Porta al +1','goals_to_plus_1'],
  ['Porta al +2','goals_to_plus_2'],['Porta al +3 o più','goals_to_plus_3'],
  ['Gol che riducono il distacco','deficit_reducers'],['Gol sotto nel punteggio','trailing_goals'],
  ['Pareggi in rimonta','comeback_equalizers'],['Vantaggi in rimonta','comeback_go_ahead_goals'],
  ['Ampliano il vantaggio','lead_extenders'],['Pareggi / 80′','equalizers_per_80'],['Gol del vantaggio / 80′','go_ahead_goals_per_80'],['Gol in rimonta / 80′','comeback_go_ahead_goals_per_80'],['Gol sotto / 80′','trailing_goals_per_80'],['Ampliano il vantaggio / 80′','lead_extenders_per_80']]],
 ['impact','Impatto',[['GF in campo','goals_for_on'],['GS in campo','goals_against_on'],
  ['Plus/minus','plus_minus_on'],['GF in campo / gara','gf_on_per_game'],['GS in campo / gara','ga_on_per_game'],['+/- per gara','plus_minus_per_game'],
  ['GF / 80′','gf_on_per_80'],['GS / 80′','ga_on_per_80'],['+/- / 80′','plus_minus_per_80']]],
 ['parziali','Parziali e punti', [['Gare con parziale verificato','stint_games'],['Minuti totali verificati','stint_minutes'],['GF nei parziali verificati','stint_gf'],['GS nei parziali verificati','stint_ga'],['Punti dei parziali giocati','stint_points'],['Variazione punti durante la presenza','stint_points_delta'],['GF verificati / 80′','stint_gf_per_80'],['GS verificati / 80′','stint_ga_per_80'],['Punti dei parziali / 80′','stint_points_per_80'],['Variazione punti / 80′','stint_points_delta_per_80']]],
 ['rating','Rating',[['MVP','mvp_awards'],['MVP / gara','mvp_per_game'],['Media voto','avg_rating'],['Gare valutate','rated_matches'],
  ['Voti ricevuti','votes_received'],['Voti / gara valutata','votes_per_rated_game'],['Gare ≥7','high_rating_games'],['Gare ≥7 (%)','high_rating_pct'],
  ['Gare <6','low_rating_games'],['Gare <6 (%)','low_rating_pct'],['Voto massimo','highest_rating'],
  ['Voto minimo','lowest_rating'],['Variabilità','rating_volatility']]],
 ['discipline','Disciplina',[['Ammonizioni','yellow_cards'],['Espulsioni','red_cards'],['Cartellini blu','blue_cards'],['Gialli / gara','yellows_per_game'],['Gialli / 80′','yellows_per_80'],['Rossi / 80′','reds_per_80'],['Cartellini / 80′','cards_per_80']]]
 ];
 const detailGroups=DETAIL_METRICS.flatMap(([key,title,options])=>{
  const values=merged.map(p=>{
   const detail=aggregateEventDetails(events,{playerId:p.player_id,side:'team'}).groups[key];
   return {...p,detail_counts:detail.counts};
  });
  return options.map(([code,label])=>rankingRows(title+' · '+label,values.map(v=>({...v,event_detail_value:v.detail_counts[code]})),'event_detail_value')).filter(Boolean);
 }).filter(Boolean);
 groups.push(['goal-details','Dinamiche dei gol',[]]);
 const tabsFinal='<div class="stats-ranking-tabs" role="tablist" aria-label="Tipo statistiche giocatore">'+groups.map(([id,title],i)=>
 '<button type="button" data-stats-ranking="'+id+'" role="tab" aria-selected="'+(i===0)+'">'+E(title)+'</button>').join('')+'</div>';
 const stintDescriptions={
  stint_games:'Numero di gare con una presenza effettiva e con minuti, cambi e gol verificabili. Identifica il campione verificato; per i valori su 80′ si usa invece la somma dei minuti effettivamente giocati.',
  stint_minutes:'Somma dei minuti effettivamente giocati in tutte le presenze con timeline verificata. È il denominatore utilizzato per normalizzare le statistiche su 80 minuti.',
  stint_gf:'Somma dei gol segnati dalla squadra esclusivamente negli intervalli in cui il giocatore era in campo.',
  stint_ga:'Somma dei gol subiti dalla squadra esclusivamente negli intervalli in cui il giocatore era in campo.',
  stint_points:'Per ogni gara assegna 3, 1 oppure 0 punti al parziale maturato mentre il giocatore era in campo; poi somma i punti di tutte le gare verificabili.',
  stint_points_delta:'Per ogni intervallo confronta i punti relativi al risultato al momento dell’ingresso con quelli al momento dell’uscita. Esempio: da 1-0 a 1-1 = −2 punti; somma le differenze.',
  stint_gf_per_80:'Gol segnati durante la presenza × 80 / totale minuti effettivi verificati. Gli spezzoni brevi pesano in proporzione alla loro durata.',
  stint_ga_per_80:'Gol subiti durante la presenza × 80 / totale minuti effettivi verificati. Denominatore: tutti i minuti verificati del giocatore.',
  stint_points_per_80:'Somma dei punti dei parziali × 80 / minuti totali verificati. È un tasso normalizzato, non un massimo di 3 punti a partita.',
  stint_points_delta_per_80:'Somma delle variazioni di punti × 80 / minuti totali verificati. Valori negativi indicano peggioramento del risultato nel tempo giocato.'
 };
 const panels=groups.map(([id,title,metrics],i)=>{
  const slides=(id==='goal-details'?detailGroups:metrics.map(([metric,key])=>rankingRows(metric,merged,key)).filter(Boolean));
  return '<section class="stats-player-carousel" data-stats-ranking-panel="'+id+'" data-stats-active-index="0"'+(i?' hidden':'')+'>'+
  '<div class="stats-player-carousel-top"><div><span class="eyebrow">CONFRONTO GIOCATORI</span><h3>'+E(title)+'</h3></div>'+
  '<div class="stats-player-carousel-controls"><button type="button" data-stats-slide="-1" disabled aria-label="Statistica precedente">‹</button>'+
  '<span class="stats-player-carousel-count">'+(slides.length?'1 / '+slides.length:'0 / 0')+'</span>'+
  '<button type="button" data-stats-slide="1"'+(slides.length<2?' disabled':'')+' aria-label="Statistica successiva">›</button></div></div>'+

  '<div class="stats-player-carousel-track" tabindex="0">'+(slides.length?slides.map((slide,n)=>'<div class="stats-player-carousel-slide" aria-label="Statistica '+(n+1)+' di '+slides.length+'">'+(id==='parziali'?'<p class="stats-hint stats-stint-slide-description">'+E(stintDescriptions[metrics[n]?.[1]]||'')+'</p>':'')+slide+'</div>').join(''):'<p class="tm-analytics-empty">Nessun dato confrontabile in questa categoria.</p>')+'</div></section>';
 }).join('');
 return '<div class="stats-player-section"><header class="tm-analytics-header"><span class="eyebrow">PLAYER INTELLIGENCE</span><h2>Ogni giocatore, nel suo contesto.</h2><p>Ranking comparabili, impatto e continuità. Una metrica per slide.</p></header>'+tabsFinal+panels+'<p class="stats-hint">Parziali e punti considerano soltanto spezzoni verificabili. Scorri orizzontalmente per confrontare gli indicatori.</p></div>';
}


/* Competition intelligence: one source of results and one view per distinct metric. */
function tournamentNumbers(fixtures,competitions,flowRows=[],phaseRows=[],eventContexts=[],opponentFlows=[],teamComparisons=[],fixtureEvents=[],team=null,opponents=[]){
 const validScore=f=>f.home_score!==null&&f.away_score!==null&&Number.isInteger(Number(f.home_score))&&Number.isInteger(Number(f.away_score));
 const finished=(fixtures||[]).filter(f=>f.status==='finished'&&!f.is_test&&validScore(f));
 const ids=new Set(finished.map(f=>String(f.id)));
 const byFixture=new Map();
 for(const e of fixtureEvents||[]){
  if(!ids.has(String(e.fixture_id))||!['official','community_confirmed'].includes(e.validation_status))continue;
  const key=String(e.fixture_id);if(!byFixture.has(key))byFixture.set(key,[]);
  byFixture.get(key).push(e);
 }
 const names=new Map((opponents||[]).map(o=>[String(o.id),o.short_name||o.name]));
 if(team?.id)names.set(String(team.id),team.name||'Caselle');
 const nameOf=(f,side)=>names.get(String(f[side+'_team_id']||f[side+'_opponent_id']||''))||f[side+'_team']||null;
 const rows=new Map();
 const add=(f,side)=>{
  const name=nameOf(f,side);if(!name)return;
  const home=side==='home',gf=Number(f[side+'_score']),ga=Number(f[home?'away_score':'home_score']);
  const id=String(f.competition_id),key=id+'|'+name.toLocaleLowerCase('it');
  let r=rows.get(key);
  if(!r){r={competition_id:id,name,resultGames:0,played:0,wins:0,draws:0,losses:0,gf:0,ga:0,home:0,away:0,
   homeWins:0,awayWins:0,yellows:0,reds:0,blues:0,changes:0,observed:0,ordered:0,timed:0,goalsVerified:0,
   fromBehind:0,comebackPoints:0,fromAhead:0,leadLost:0};rows.set(key,r)}
  r.played++;r.resultGames++;r.gf+=gf;r.ga+=ga;r[gf>ga?'wins':gf===ga?'draws':'losses']++;
  r[home?'home':'away']++;if(gf>ga)r[home?'homeWins':'awayWins']++;
  const ev=byFixture.get(String(f.id))||[];
  const homeTeam=Boolean(f.home_team_id),awayTeam=Boolean(f.away_team_id);
  const sideOf=e=>e.team_side==='team'?(homeTeam?'home':awayTeam?'away':null):
   e.team_side==='opponent'?(homeTeam?'away':awayTeam?'home':null):e.team_side;
  if(ev.length)r.observed++;
  for(const e of ev){
   if(sideOf(e)!==side)continue;
   if(e.event_type==='yellow_card')r.yellows++;
   if(e.event_type==='red_card'||e.event_type==='second_yellow')r.reds++;
   if(e.event_type==='blue_card')r.blues++;
   if(e.event_type==='substitution')r.changes++;
  }
  const goals=ev.filter(e=>['goal','penalty_goal','penalty_scored','own_goal'].includes(e.event_type)&&e.payload?.count_score!==false);
  const scorer=e=>e.event_type==='own_goal'?(sideOf(e)==='home'?'away':'home'):sideOf(e);
  if(goals.length!==Number(f.home_score)+Number(f.away_score)||
   goals.some(e=>!['home','away'].includes(scorer(e)))||
   goals.filter(e=>scorer(e)==='home').length!==Number(f.home_score)||
   goals.filter(e=>scorer(e)==='away').length!==Number(f.away_score))return;
  r.goalsVerified++;
  const indexOf=e=>e.payload?.sequence_order??e.payload?.event_order??e.source_raw?.sequence_order;
  const hasOrder=goals.every(e=>indexOf(e)!==null&&indexOf(e)!==undefined&&Number.isInteger(Number(indexOf(e))));
  const hasMinutes=goals.every(e=>e.minute!==null&&e.minute!==undefined&&Number.isInteger(Number(e.minute)));
  if(hasMinutes)r.timed++;
  if(!hasOrder&&!hasMinutes)return;
  const sorted=[...goals].sort((a,b)=>hasOrder?Number(indexOf(a))-Number(indexOf(b)):
   Number(a.minute)-Number(b.minute)||Number(a.stoppage_minute||0)-Number(b.stoppage_minute||0));
  const keys=sorted.map(e=>hasOrder?Number(indexOf(e)):Number(e.minute)*100+Number(e.stoppage_minute||0));
  if(new Set(keys).size!==keys.length)return;
  r.ordered++;
  let us=0,them=0,wasAhead=false,wasBehind=false;
  for(const e of sorted){
   if(scorer(e)===side)us++;else them++;
   if(us>them)wasAhead=true;if(us<them)wasBehind=true;
  }
  if(wasBehind){r.fromBehind++;if(gf>=ga)r.comebackPoints++}
  if(wasAhead){r.fromAhead++;if(gf<=ga)r.leadLost++}
 };
 for(const f of finished){add(f,'home');add(f,'away')}
 for(const f of teamComparisons||[]){
  if(!f.team_name)continue;
  const id=String(f.competition_id),name=String(f.team_name),key=id+'|'+name.toLocaleLowerCase('it');
  if(!rows.has(key))rows.set(key,{competition_id:id,name,resultGames:0,played:Number(f.played)||0,wins:0,draws:0,losses:0,
   gf:0,ga:0,home:0,away:0,homeWins:0,awayWins:0,yellows:0,reds:0,blues:0,changes:0,
   observed:0,ordered:0,timed:0,goalsVerified:0,fromBehind:0,comebackPoints:0,fromAhead:0,leadLost:0});
 }
 const all=[...rows.values()].sort((a,b)=>a.name.localeCompare(b.name,'it'));
 if(!all.length)return '<section class="tm-analytics-header"><h2>Confronto squadre</h2><p>Non ci sono risultati ufficiali completi per questa stagione.</p></section>';
 const flowLookup=new Map((teamComparisons||[]).map(r=>[String(r.competition_id)+'|'+String(r.team_name||'').toLocaleLowerCase('it'),r]));
 for(const r of all){r.flow=flowLookup.get(r.competition_id+'|'+r.name.toLocaleLowerCase('it'))||null}
 const statRank=(title,data,get,unit='',less=false)=>{
  const values=data.map(t=>({t,value:get(t)})).filter(x=>x.value!==null&&x.value!==undefined&&Number.isFinite(Number(x.value)))
   .sort((a,b)=>less?Number(a.value)-Number(b.value):Number(b.value)-Number(a.value));
  if(!values.length)return '<section class="tm-compare-ranking"><h3>'+E(title)+'</h3><p class="tm-analytics-empty">Dati non sufficienti.</p></section>';
  const high=Math.max(1,...values.map(x=>Math.abs(Number(x.value))));
  return '<section class="tm-compare-ranking"><h3>'+E(title)+'</h3><div class="tm-compare-rows">'+values.map((x,i)=>
   '<div class="tm-compare-row" title="'+E(x.t.name)+'"><span>'+String(i+1).padStart(2,'0')+'</span>'+
   '<strong>'+E(x.t.name)+'</strong><div class="tm-compare-track"><i style="width:'+(100*Math.abs(Number(x.value))/high).toFixed(1)+'%"></i></div>'+
   '<b>'+E(statN(x.value,1)+unit)+'</b></div>').join('')+'</div></section>';
 };
 const scatter=allData=>{
  const data=allData.filter(r=>r.resultGames>0);
  if(!data.length)return '<p class="tm-analytics-empty">Risultati non disponibili.</p>';
  const xMax=Math.max(1,...data.map(r=>r.gf/Math.max(1,r.played)))*1.15,yMax=Math.max(1,...data.map(r=>r.ga/Math.max(1,r.played)))*1.15;
  const x=v=>52+(Number(v)/xMax)*590,y=v=>260-(Number(v)/yMax)*216;
  const marks=[0,.5,1].map(v=>'<line x1="52" y1="'+y(yMax*v)+'" x2="665" y2="'+y(yMax*v)+'" stroke="currentColor" opacity=".1"/>'+
   '<text x="43" y="'+(y(yMax*v)+4)+'" text-anchor="end" font-size="11" fill="currentColor" opacity=".7">'+statN(yMax*v,1)+'</text>').join('');
  return '<div class="tm-compare-scatter-wrap"><svg class="tm-compare-scatter" viewBox="0 0 720 320" role="img" aria-label="Gol fatti per gara in orizzontale, gol subiti per gara in verticale">'+
   marks+'<line x1="52" y1="260" x2="665" y2="260" stroke="currentColor" opacity=".4"/><line x1="52" y1="32" x2="52" y2="260" stroke="currentColor" opacity=".4"/>'+
   data.map(r=>{const xx=x(r.gf/r.played),yy=y(r.ga/r.played),isUs=String(r.name).toLocaleLowerCase('it')===String(team?.name||'').toLocaleLowerCase('it');
    return '<g><circle cx="'+xx.toFixed(1)+'" cy="'+yy.toFixed(1)+'" r="'+(isUs?8:5)+'" fill="'+(isUs?'#f2c078':'#70c7ad')+'" stroke="currentColor" stroke-width="1"><title>'+E(r.name)+' · '+statN(r.gf/r.played,2)+' GF/g · '+statN(r.ga/r.played,2)+' GS/g</title></circle>'+
     '<text x="'+(xx+9).toFixed(1)+'" y="'+(yy-8).toFixed(1)+'" fill="currentColor" font-size="10">'+E(String(r.name).slice(0,13))+'</text></g>';
   }).join('')+
   '<text x="352" y="305" font-size="12" fill="currentColor" text-anchor="middle">Gol fatti / gara →</text><text x="16" y="155" font-size="12" transform="rotate(-90 16 155)" fill="currentColor" text-anchor="middle">← Meno gol subiti / gara</text></svg>'+
   '<p class="tm-analytics-note">Ogni punto è una squadra. In basso a destra: più produzione offensiva e meno gol subiti. Caselle evidenziato in oro.</p></div>';
 };
 const competitionsIds=[...new Set(all.map(x=>x.competition_id))];
 const pane=(id,idx)=>{
  const data=all.filter(x=>x.competition_id===id);
  const options=[
   ['results','Rendimento',scatter(data)+statRank('Vittorie sulle partite disputate',data,r=>r.resultGames?100*r.wins/r.resultGames:null,'%')],
   ['flow','Andamento','<div class="tm-compare-grid">'+
     statRank('Tempo in vantaggio',data,r=>r.flow?.verified_games>0?r.flow.lead_pct:null,'%')+
     statRank('Tempo in svantaggio',data,r=>r.flow?.verified_games>0?r.flow.trail_pct:null,'% ',true)+
     statRank('Partite in rimonta con punti',data,r=>r.ordered?r.comebackPoints:null)+
     statRank('Pareggi in rimonta',data,r=>r.flow?.verified_games>0?r.flow.comeback_equalizers:null)+
     statRank('Vantaggi non conservati',data,r=>r.ordered?r.leadLost:null)+'</div>'],
   ['venues','Casa e trasferta','<div class="tm-compare-grid">'+
     statRank('Vittorie in casa (%)',data,r=>r.home?100*r.homeWins/r.home:null,'%')+
     statRank('Vittorie fuori casa (%)',data,r=>r.away?100*r.awayWins/r.away:null,'%')+'</div>'],
   ['discipline','Disciplina e cambi','<div class="tm-compare-grid">'+
     statRank('Gialli documentati',data,r=>r.observed?r.yellows:null)+
     statRank('Rossi documentati',data,r=>r.observed?r.reds:null)+
     statRank('Cartellini blu documentati',data,r=>r.observed?r.blues:null)+
     statRank('Cambi nelle gare documentate',data,r=>r.observed?r.changes/r.observed:null)+'</div>'],
   ['coverage','Affidabilità','<div class="tm-compare-grid">'+
     statRank('Gare con sequenza gol verificata',data,r=>r.played?100*r.ordered/r.played:null,'%')+
     statRank('Gare con minutaggio completo',data,r=>r.played?100*r.timed/r.played:null,'%')+
     statRank('Gare con almeno un evento registrato',data,r=>r.played?100*r.observed/r.played:null,'%')+'</div>']
  ];
  return '<section data-extended-comp-panel="'+E(id)+'"'+(idx?' hidden':'')+'>'+
   '<nav class="stats-insights-nav" aria-label="Categoria del confronto">'+options.map(([key,label],i)=>
    '<button type="button" data-extended-metric="'+key+'" aria-pressed="'+(i===0)+'">'+E(label)+'</button>').join('')+'</nav>'+
   options.map(([key,label,body],i)=>'<div data-extended-metric-panel="'+key+'"'+(i?' hidden':'')+'>'+body+'</div>').join('')+'</section>';
 };
 return '<section class="stats-insights tm-compare-dashboard"><header class="tm-analytics-header">'+
  '<span class="eyebrow">COMPETITION INTELLIGENCE</span><h2>Le squadre a confronto.</h2>'+
  '<p>Rendimento, andamento e disciplina. Non una seconda classifica.</p></header>'+
  (competitionsIds.length>1?'<nav class="stats-insights-competitions" aria-label="Seleziona competizione">'+competitionsIds.map((id,i)=>
   '<button type="button" data-extended-comp="'+E(id)+'" aria-pressed="'+(i===0)+'">'+
   E(competitions.find(c=>String(c.id)===id)?.name||'Torneo')+'</button>').join('')+'</nav>':'')+
  competitionsIds.map(pane).join('')+
  '<footer class="stats-insights-foot">Risultati ufficiali per tutte le squadre; avanzamento e disciplina basati solo su eventi confermati. “—” significa dato non verificabile, non zero.</footer></section>';
}

export function renderEventAnalytics(fixtures,matches,events,team,competitions=[],playerStats=[],opponents=[],matchPlayers=[],venues=[],predictionSnapshots=[],history=[],goalImpacts=[],ratingInsights=[],playerComparisons=[],matchFlows=[],flowPhases=[],flowEventContexts=[],opponentFlows=[],teamComparisons=[],mvpCounts=new Map(),fixtureEvents=[]){
 const tabs='<nav class="stats-scope-tabs" role="tablist" aria-label="Ambito delle statistiche">'+
 [['team','Squadra · Caselle'],['players','Giocatori · Caselle'],['all','Complessivo · Torneo']].map(([id,label],i)=>
 '<button type="button" role="tab" data-stats-scope="'+id+'" aria-selected="'+(i===0)+'">'+E(label)+'</button>').join('')+'</nav>';
 return tabs+'<div class="stats-scope-panel" data-stats-panel="team">'+
 renderTeamAnalytics(fixtures,matches,events,team,competitions,playerStats,opponents,matchPlayers,venues,predictionSnapshots,history)+
 '</div><div class="stats-scope-panel" data-stats-panel="players" hidden>'+playersNumbers(playerStats,goalImpacts,ratingInsights,playerComparisons,events,mvpCounts,playerStintPoints(matches,matchPlayers,events,fixtures,competitions))+
 '</div><div class="stats-scope-panel" data-stats-panel="all" hidden>'+tournamentNumbers(fixtures,competitions,matchFlows,flowPhases,flowEventContexts,opponentFlows,teamComparisons,fixtureEvents,team,opponents)+'</div>';
}
