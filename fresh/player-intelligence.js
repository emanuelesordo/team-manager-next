import {matchPlayerIntervals,matchElapsedMinute,confirmedMatchEvent} from './player-participation.js';

const K=x=>String(x??'');
const E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;', '"':'&quot;',"'":'&#39;'}[c]));
const GOALS=new Set(['goal','penalty_goal','penalty_scored','own_goal']);
const ACCEPT=e=>confirmedMatchEvent(e)&&e.payload?.count_score!==false;
const number=x=>Number.isFinite(x)?x.toLocaleString('it-IT',{maximumFractionDigits:2}):'—';
const rate=(x,mins,unit)=>mins>0?number(x*unit/mins):'—';
const inRange=(x,ints)=>ints.some(([a,b])=>x>=a&&x<b);
const metric=(title,value,note='')=>'<div class="psi-metric"><span>'+E(title)+'</span><strong>'+E(value)+'</strong><small>'+E(note)+'</small></div>';
const segment=(title,items,note='')=>'<article class="psi-slide"><h3>'+E(title)+'</h3><div class="psi-metrics">'+items.map(x=>metric(...x)).join('')+'</div>'+(note?'<p class="psi-note">'+E(note)+'</p>':'')+'</article>';
function lineChart(values,labels,title){
 if(!values.length)return '<p class="psi-note">Dati insufficienti per il grafico.</p>';
 const nums=values.filter(Number.isFinite);if(!nums.length)return '<p class="psi-note">Nessuna gara con intervalli affidabili.</p>';const lo=Math.min(0,...nums),hi=Math.max(1,...nums),w=560,h=176,p=26;
 const pts=values.map((v,i)=>Number.isFinite(v)?[p+i*(w-2*p)/Math.max(1,values.length-1),h-p-(v-lo)/(hi-lo)*(h-2*p)]:null);
 const groups=[];let run=[];for(const a of pts){if(a)run.push(a);else if(run.length){groups.push(run);run=[]}}if(run.length)groups.push(run);const poly=groups.map(g=>'<polyline points="'+g.map(p=>p.join(',')).join(' ')+'" fill="none" stroke="#55af95" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>').join('');
 return '<div class="psi-line-wrap"><svg class="psi-line" viewBox="0 0 560 176" role="img" aria-label="'+E(title)+'"><path d="M26 150H534M26 25H534" fill="none" stroke="currentColor" opacity=".15"/>'+poly+''+pts.map((a,i)=>a?'<circle cx="'+a[0]+'" cy="'+a[1]+'" r="4" fill="#55af95"><title>'+E(labels[i])+': '+E(number(values[i]))+'</title></circle>':'').join('')+'</svg><div class="psi-axis"><span>'+E(labels[0]||'')+'</span><span>'+E(labels.at(-1)||'')+'</span></div></div>';
}
function donut(values){
 const entries=values.filter(x=>x[1]>0),sum=entries.reduce((n,x)=>n+x[1],0);
 if(!sum)return '<p class="psi-note">Nessun dato disponibile per la distribuzione.</p>';
 let offset=0;
 const colors=['#55af95','#8f99aa','#e5a76a','#c87c88','#749ad0'];
 const gradients=entries.map((x,i)=>{const start=offset;offset+=x[1]/sum*100;return colors[i%colors.length]+' '+start+'% '+offset+'%'}).join(',');
 return '<div class="psi-donut-row"><div class="psi-donut" style="background:conic-gradient('+gradients+')" role="img" aria-label="'+E(entries.map(x=>x[0]+' '+Math.round(x[1]/sum*100)+'%').join(', '))+'"><span>'+number(sum)+'</span></div><div class="psi-legend">'+entries.map((x,i)=>'<div><i style="background:'+colors[i%colors.length]+'"></i><span>'+E(x[0])+'</span><b>'+Math.round(x[1]/sum*100)+'%</b></div>').join('')+'</div></div>';
}
const status=(gf,ga)=>gf>ga?'V':gf<ga?'P':'N';
const points=(gf,ga)=>gf>ga?3:gf===ga?1:0;

/** Uses match-local player intervals; missing or contradictory event timelines yield N/D, never invented on-field goals. */
export function playerIntelligence(playerId,{fixtures=[],matches=[],matchPlayers=[],events=[],competitions=[],team=null,stats={}}={}){
 const byMatch=new Map(), byFixture=new Map(fixtures.map(f=>[K(f.id),f]));
 for(const e of events){if(!ACCEPT(e))continue;const k=K(e.match_id);if(!byMatch.has(k))byMatch.set(k,[]);byMatch.get(k).push(e)}
 const pRows=new Map();
 for(const p of matchPlayers){const k=K(p.match_id);if(!pRows.has(k))pRows.set(k,[]);pRows.get(k).push(p)}
 const total={games:0,starts:0,bench:0,unused:0,minutes:0,minutesKnown:0,goals:0,assists:0,subGoals:0,subAssists:0,firstGoals:0,equalizers:0,leadGoals:0,comeFromBehindGoals:0,goalWins:0,braces:0,hattricks:0,scoredMinutes:[],assistedMinutes:[],gfOn:0,gaOn:0,gfOff:0,gaOff:0,onMinutes:0,offMinutes:0,covered:0,eligible:0,states:{leading:0,drawing:0,trailing:0},results:{W:0,D:0,L:0},starterPoints:0,subPoints:0,entryPointsDelta:0,exitPointsDelta:0,red:0,yellow:0,trend:[],rating:[],matches:[],duration:80,positionGroups:{},goalsByPeriod:[0,0],goalsByContext:[0,0,0],onOffGames:0,fullGames:0,cleanOn:0,entryMinutes:[],exitMinutes:[],home:{games:0,goals:0,assists:0,points:0},away:{games:0,goals:0,assists:0,points:0},teamGoalsDuringAppearances:0};
 for(const m of matches){
  if(m.is_test||m.status!=='finished')continue;
  const f=byFixture.get(K(m.fixture_id));if(!f||f.status!=='finished'||!Number.isInteger(f.home_score)||!Number.isInteger(f.away_score))continue;
  const home=K(f.home_team_id)===K(team?.id),away=K(f.away_team_id)===K(team?.id);
  if(home===away)continue;
  const p=pRows.get(K(m.id))||[], me=p.find(x=>K(x.player_id)===K(playerId));
  if(!me)continue;
  const comp=competitions.find(x=>K(x.id)===K(f.competition_id||m.competition_id))||{};
  const half=Number(m.minutes_per_period_override||comp.minutes_per_period)||40;
  const base=half*(Number(m.periods_override||comp.periods)||2);
  const gameEvents=(byMatch.get(K(m.id))||[]).map(e=>({...e,team_side:e.team_side==='home'?(home?'team':'opponent'):e.team_side==='away'?(away?'team':'opponent'):e.team_side}));
  const timeline=matchPlayerIntervals(m,p,gameEvents,comp);
  const duration=timeline.timing.duration;total.duration=timeline.timing.half*timeline.timing.periods;
  const minute=e=>matchElapsedMinute(e,comp,timeline.timing);
  const participation=timeline.players.get(K(playerId));
  const started=me.started===true;
  const intervals=participation?.intervals||[],bad=!participation?.valid;
  const redEvents=gameEvents.filter(e=>e.team_side==='team'&&K(e.player_id)===K(playerId)&&['red_card','second_yellow'].includes(e.event_type));
  const played=participation?.entered||intervals.some(([a,b])=>b>a);
  const record=started||played;
  if(!record){if(me.selection_status!=='unavailable')total.unused++;continue}
  total.games++;if(started)total.starts++;else total.bench++;
  if(!bad){const mins=intervals.reduce((n,[a,b])=>n+b-a,0);total.minutes+=mins;total.minutesKnown++;total.eligible++;if(started&&intervals.length===1&&intervals[0][0]===0&&intervals[0][1]===duration)total.fullGames++;if(!started&&intervals.length)total.entryMinutes.push(intervals[0][0]);if(intervals.length&&intervals.at(-1)[1]<duration)total.exitMinutes.push(intervals.at(-1)[1]);}
  const gf=home?f.home_score:f.away_score,ga=home?f.away_score:f.home_score;
  total.results[gf>ga?'W':gf<ga?'L':'D']++;
  const location=home?total.home:total.away;location.games++;location.points+=points(gf,ga);total.teamGoalsDuringAppearances+=gf;
  if(started)total.starterPoints+=points(gf,ga);else total.subPoints+=points(gf,ga);
  const orderedGoals=gameEvents.filter(e=>GOALS.has(e.event_type)&&e.payload?.count_score!==false).sort((a,b)=>(minute(a)??Infinity)-(minute(b)??Infinity)||K(a.created_at).localeCompare(K(b.created_at)));
  const goalsGood=orderedGoals.length===gf+ga&&orderedGoals.every(e=>minute(e)!==null&&['team','opponent'].includes(e.team_side));
  const normalized=orderedGoals.map(e=>({...e,scoreSide:e.event_type==='own_goal'?(e.team_side==='team'?'opponent':'team'):e.team_side,t:minute(e)}));
  let gOwn=0,aOwn=0,scoreF=0,scoreA=0;
  for(const e of normalized){
   const beforeF=scoreF,beforeA=scoreA;
   if(e.scoreSide==='team'){
    if(K(e.player_id)===K(playerId)&&e.event_type!=='own_goal'){
     gOwn++;total.goals++;if(!started)total.subGoals++;
     if(e.t!=null){total.scoredMinutes.push(e.t);total.goalsByPeriod[e.t<=half?0:1]++}
     if(beforeF===0&&beforeA===0)total.firstGoals++;
     if(beforeF<beforeA&&beforeF+1===beforeA)total.equalizers++;
     if(beforeF===beforeA)total.leadGoals++;
     if(beforeF<beforeA)total.comeFromBehindGoals++;
     total.goalsByContext[beforeF>beforeA?0:beforeF===beforeA?1:2]++;
    }
    if(K(e.secondary_player_id)===K(playerId)&&K(e.player_id)!==K(playerId)){aOwn++;total.assists++;if(!started)total.subAssists++;if(e.t!=null)total.assistedMinutes.push(e.t)}
    scoreF++;
   }else if(e.scoreSide==='opponent')scoreA++;
  }
  location.goals+=gOwn;location.assists+=aOwn;
  if(gOwn>=2)total.braces++;if(gOwn>=3)total.hattricks++;
  total.yellow+=gameEvents.filter(e=>e.event_type==='yellow_card'&&e.team_side==='team'&&K(e.player_id)===K(playerId)).length;
  total.red+=redEvents.length;
  const game={label:new Date(f.kickoff_at||m.kickoff_at).toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit'}),gf,ga,minutes:bad?null:intervals.reduce((n,[a,b])=>n+b-a,0),goals:gOwn,assists:aOwn,pm:null,rating:null,quality:goalsGood&&!bad?'verificata':'parziale'};
  // Reconcile full score, otherwise plus/minus and state times remain N/D.
  if(goalsGood&&!bad&&normalized.filter(x=>x.scoreSide==='team').length===gf&&normalized.filter(x=>x.scoreSide==='opponent').length===ga){
   let localGF=0,localGA=0,last=0,curF=0,curA=0;
   const boundaries=[...new Set([0,duration,...intervals.flat(),...normalized.map(x=>x.t)])].sort((a,b)=>a-b);
   for(let i=0;i<boundaries.length-1;i++){
    const a=boundaries[i],b=boundaries[i+1],mid=(a+b)/2;
    const before=normalized.filter(x=>x.t<=a);
    curF=before.filter(x=>x.scoreSide==='team').length;curA=before.length-curF;
    if(inRange(mid,intervals))total.states[curF>curA?'leading':curF<curA?'trailing':'drawing']+=b-a;
   }
   for(const e of normalized){if(inRange(e.t+0.00001,intervals)){if(e.scoreSide==='team')localGF++;else localGA++}}
   const on=game.minutes;
   total.covered++;total.gfOn+=localGF;total.gaOn+=localGA;if(localGA===0)total.cleanOn++;
   total.gfOff+=gf-localGF;total.gaOff+=ga-localGA;
   total.onMinutes+=on;total.offMinutes+=duration-on;
   game.pm=localGF-localGA;
   total.onOffGames++;
   const entry=intervals[0]?.[0]??0,exit=intervals.at(-1)?.[1]??duration;
   const beforeEntry=normalized.filter(x=>x.t<entry);
   const beforeExit=normalized.filter(x=>x.t<=exit);
   const pAt=arr=>points(arr.filter(x=>x.scoreSide==='team').length,arr.filter(x=>x.scoreSide==='opponent').length);
   if(!started)total.entryPointsDelta+=points(gf,ga)-pAt(beforeEntry);
   if(exit<duration)total.exitPointsDelta+=points(gf,ga)-pAt(beforeExit);
   // Goal that makes the final lead and remains unanswered by opponent.
   let ownScoreF=0,ownScoreA=0;
   normalized.forEach((e,i)=>{if(e.scoreSide==='team')ownScoreF++;else ownScoreA++;
    if(e.scoreSide==='team'&&K(e.player_id)===K(playerId)&&gf>ga&&ownScoreF===ga+1&&ownScoreF>ownScoreA)total.goalWins++;
   });
  }
  total.matches.push(game);
 }
 total.trend=total.matches.map((x,i)=>({label:x.label,value:x.pm===null?null:total.matches.slice(0,i+1).reduce((n,m)=>n+(m.pm??0),0),verified:x.pm!==null}));
 return total;
}
export function renderPlayerIntelligence(id,source){
 const v=playerIntelligence(id,source),canonical=source?.stats||{},canonicalNumber=(field,fallback)=>canonical[field]===null||canonical[field]===undefined||canonical[field]===''?fallback:(Number.isFinite(Number(canonical[field]))?Number(canonical[field]):fallback);
 // Roster / app_player_season_stats is the single source of truth for totals.
 v.games=canonicalNumber('appearances',v.games);
 v.starts=canonicalNumber('starts',v.starts);
 // Count actual entrances, not the difference between appearances and starts.
 const finishedIds=new Set((source?.matches||[]).filter(m=>m.status==='finished'&&!m.is_test).map(m=>K(m.id)));
 const confirmedEntries=new Set((source?.events||[]).filter(e=>
  finishedIds.has(K(e.match_id))&&e.event_type==='substitution'&&
  K(e.secondary_player_id)===K(id)&&['official','community_confirmed'].includes(e.validation_status)
 ).map(e=>K(e.match_id)));
 const hasCanonicalAppearances=canonical.appearances!==null&&canonical.appearances!==undefined;
 const hasCanonicalStarts=canonical.starts!==null&&canonical.starts!==undefined;
 // An unambiguous official entrance is positive evidence, even if another view or local reconstruction is stale.
 const finalSubentries=canonicalNumber('subentries',null);
 v.bench=finalSubentries!==null?finalSubentries:
  (hasCanonicalAppearances&&hasCanonicalStarts?Math.max(0,v.games-v.starts):confirmedEntries.size);
 const totalsConsistent=v.bench+v.starts===v.games;
 v.goals=canonicalNumber('goals',v.goals);
 v.assists=canonicalNumber('assists',v.assists);
 v.yellow=canonicalNumber('yellow_cards',v.yellow);
 v.red=canonicalNumber('red_cards',v.red);
 const incompleteGames=v.matches.length!==v.games||v.matches.filter(m=>m.minutes===null).length>0;
 const incompleteGoals=v.matches.reduce((n,m)=>n+m.goals,0)!==v.goals;
 const incompleteAssists=v.matches.reduce((n,m)=>n+m.assists,0)!==v.assists;
 const hasFinalMinutes=Object.prototype.hasOwnProperty.call(canonical,'minutes');
 const officialMinutes=canonical.minutes==null?null:Number(canonical.minutes);
 const usableOfficialMinutes=Number.isFinite(officialMinutes)&&officialMinutes>=0;
 const minutes=hasFinalMinutes?officialMinutes:v.minutes,base=v.duration,pm=v.gfOn-v.gaOn,hasOn=v.covered>0;
 const minuteSource=hasFinalMinutes?(usableOfficialMinutes?'Stessa fonte verificata della Rosa':'Minuti non verificabili'):'Ricostruzione da eventi';
 const minuteCoverage=hasFinalMinutes?usableOfficialMinutes:v.minutesKnown===v.games&&!incompleteGames;
 const title=(t,content)=>'<section class="psi-group"><div class="psi-head"><h2>'+E(t)+'</h2><span>Scorri per le altre metriche →</span></div><div class="psi-carousel" tabindex="0">'+content+'</div></section>';
 const coverage='Timeline complete: '+v.covered+' / '+v.eligible+' gare con minuti ricostruibili. Dove i dati mancano, gli indicatori di campo sono N/D.';
 const intro='<div class="psi-summary">'+metric('Presenze',v.games,v.starts+' titolare · '+(totalsConsistent?v.bench:'N/D')+' subentrato')+metric('Minuti giocati',minuteCoverage?number(minutes)+'′':'—',minuteSource)+metric('Gol + assist',v.goals+v.assists,v.goals+' gol · '+v.assists+' assist')+metric('Plus/minus',hasOn?(pm>0?'+':'')+number(pm):'—',v.covered+' gare verificate')+'</div>';
 const safeRate=(n)=>minuteCoverage?rate(n,minutes,base):'—';
 const avg=a=>a.length?number(a.reduce((x,y)=>x+y,0)/a.length)+'′':'—';
 const use=title('Impiego',segment('Presenze e utilizzo',[
 ['Partite giocate',v.games],['Titolare',v.starts],['Subentrato',totalsConsistent?v.bench:'—'],['Panchina inutilizzata',incompleteGames?'—':v.unused],['Partite complete',incompleteGames?'—':v.fullGames],['Minuti per presenza',minuteCoverage&&v.games?number(minutes/v.games):'—'],['% titolarità',v.games?number(v.starts/v.games*100)+'%':'—']])+segment('Ingressi e uscite', [['Minuto medio ingresso',avg(v.entryMinutes)],['Minuto medio uscita',avg(v.exitMinutes)],['Ingresso registrato',v.entryMinutes.length],['Uscita registrata',v.exitMinutes.length]])+
 segment('Rendimento per tempo',[['Gol / '+base+"′",safeRate(v.goals)],['Assist / '+base+"′",safeRate(v.assists)],['Gol + assist / '+base+"′",safeRate(v.goals+v.assists)],['Minuti / gol',v.goals&&minutes&&minuteCoverage?number(minutes/v.goals)+'′':'—'],['Minuti / G+A',(v.goals+v.assists)&&minutes&&minuteCoverage?number(minutes/(v.goals+v.assists))+'′':'—']], 'Il totale dei minuti proviene dalla stessa statistica visualizzata nella Rosa. Il plus/minus richiede invece una timeline verificabile.'));
 const attack=title('Produzione offensiva',segment('Gol e assist',[
 ['Gol',v.goals],['Assist',v.assists],['Gol da subentrato',incompleteGoals||incompleteGames?'—':v.subGoals],['Assist da subentrato',incompleteAssists||incompleteGames?'—':v.subAssists],['Doppiette',incompleteGoals||incompleteGames?'—':v.braces],['Triplette',incompleteGoals||incompleteGames?'—':v.hattricks],['% gol squadra',!incompleteGoals&&!incompleteGames&&v.teamGoalsDuringAppearances?number(v.goals/v.teamGoalsDuringAppearances*100)+'%':'—'],['% coinvolgimento',!incompleteGoals&&!incompleteAssists&&!incompleteGames&&v.teamGoalsDuringAppearances?number((v.goals+v.assists)/v.teamGoalsDuringAppearances*100)+'%':'—']])+
 segment('Contesto delle reti',[['Apre le marcature',incompleteGoals?'—':v.firstGoals],['Gol del pareggio',incompleteGoals?'—':v.equalizers],['Gol del vantaggio',incompleteGoals?'—':v.leadGoals],['Gol in rimonta',incompleteGoals?'—':v.comeFromBehindGoals],['Gol potenzialmente decisivi',incompleteGoals?'—':v.goalWins]],'Gol decisivi: criterio descrittivo legato al punteggio finale, non una misura causale.'));
 const impact=title('Impatto in campo',segment('Differenza reti con il giocatore',[
 ['GF in campo',hasOn?v.gfOn:'—'],['GS in campo',hasOn?v.gaOn:'—'],['Plus/minus',hasOn?(pm>0?'+':'')+pm:'—'],['GF / '+base+"′",rate(v.gfOn,v.onMinutes,base)],['GS / '+base+"′",rate(v.gaOn,v.onMinutes,base)],['+/- / '+base+"′",rate(pm,v.onMinutes,base)]],coverage)+
 segment('Dentro / fuori',[
 ['GF fuori campo',hasOn?v.gfOff:'—'],['GS fuori campo',hasOn?v.gaOff:'—'],['DR / '+base+"′ fuori",rate(v.gfOff-v.gaOff,v.offMinutes,base)],['Differenza on/off',v.onMinutes&&v.offMinutes?number(pm*base/v.onMinutes-(v.gfOff-v.gaOff)*base/v.offMinutes):'—'],['Clean sheet individuali',hasOn?v.cleanOn:'—'],['Gare verificate',v.covered]],'Confronto descrittivo: dipende anche da squadra, avversari e contesto.'));
 const outcomes=title('Risultati e disciplina',segment('Risultati delle presenze',[
 ['Vittorie',incompleteGames?'—':v.results.W],['Pareggi',incompleteGames?'—':v.results.D],['Sconfitte',incompleteGames?'—':v.results.L],['Win rate',!incompleteGames&&v.games?number(100*v.results.W/v.games)+'%':'—'],['Punti / gara',!incompleteGames&&v.games?number((v.results.W*3+v.results.D)/v.games):'—']])+
 segment('Impatto del cambio e disciplina',[
 ['Punti con ingresso',incompleteGames?'—':v.subPoints],['Punti gare da titolare',incompleteGames?'—':v.starterPoints],['Variazione punti dopo ingresso',hasOn?v.entryPointsDelta:'—'],['Variazione punti dopo uscita',hasOn?v.exitPointsDelta:'—'],['Ammonizioni',v.yellow],['Espulsioni',v.red]],'Le variazioni sono punti virtuali, non punti causalmente attribuiti al calciatore.'));
 const places=title('Casa e trasferta',segment('Rendimento per sede',[['Gare in casa',incompleteGames?'—':v.home.games],['Gol in casa',incompleteGoals?'—':v.home.goals],['Assist in casa',incompleteAssists?'—':v.home.assists],['Punti / gara in casa',!incompleteGames&&v.home.games?number(v.home.points/v.home.games):'—'],['Gare in trasferta',incompleteGames?'—':v.away.games],['Gol in trasferta',incompleteGoals?'—':v.away.goals],['Assist in trasferta',incompleteAssists?'—':v.away.assists],['Punti / gara in trasferta',!incompleteGames&&v.away.games?number(v.away.points/v.away.games):'—']]));
 const context=title('Distribuzioni','<article class="psi-slide"><h3>Stato del punteggio nei minuti giocati</h3>'+donut([['Vantaggio',v.states.leading],['Parità',v.states.drawing],['Svantaggio',v.states.trailing]])+'</article>'+
 '<article class="psi-slide"><h3>Momento dei gol</h3>'+donut([['Primo tempo',v.goalsByPeriod[0]],['Secondo tempo',v.goalsByPeriod[1]]])+'</article>'+
 '<article class="psi-slide"><h3>Situazione prima del gol</h3>'+donut([['In vantaggio',v.goalsByContext[0]],['In parità',v.goalsByContext[1]],['In svantaggio',v.goalsByContext[2]]])+'</article>');
 const trends=title('Andamento partita per partita','<article class="psi-slide"><h3>Plus/minus cumulativo</h3>'+lineChart(v.trend.map(x=>x.value),v.trend.map(x=>x.label),'Andamento plus/minus')+'</article>'+
 '<article class="psi-slide"><h3>Minuti per partita</h3>'+lineChart(v.matches.map(x=>x.minutes),v.matches.map(x=>x.label),'Minuti giocati')+'</article>'+
 '<article class="psi-slide"><h3>Gol e assist per partita</h3>'+lineChart(v.matches.map(x=>x.goals+x.assists),v.matches.map(x=>x.label),'Partecipazioni al gol')+'</article>');
 return '<div class="psi-root"><p class="psi-subtitle">Analisi stagionale · statistiche descrittive calcolate dai tabellini</p>'+intro+use+attack+impact+outcomes+places+context+trends+'<p class="psi-disclaimer">'+E(coverage)+' Presenze, titolarità, gol, assist e disciplina derivano dalla stessa fonte della Rosa; le distribuzioni avanzate richiedono eventi completi. I grafici con copertura parziale non sono una certificazione dei minuti.</p></div>';
}
