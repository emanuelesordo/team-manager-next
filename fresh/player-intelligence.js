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
 const v=playerIntelligence(id,source),canonical=source?.stats||{};
 const has=field=>Object.prototype.hasOwnProperty.call(canonical,field);
 const numeric=(field,fallback=null)=>has(field)?(canonical[field]==null||canonical[field]===''?null:Number.isFinite(Number(canonical[field]))?Number(canonical[field]):null):fallback;
 // SQL season view is the only authority for aggregate totals. The event model
 // supplies only reconciled breakdowns, not substitutes for missing SQL facts.
 const games=numeric('appearances',v.games),starts=numeric('starts',v.starts);
 const subentries=numeric('subentries',games!=null&&starts!=null?games-starts:v.bench);
 const goals=numeric('goals',v.goals),assists=numeric('assists',v.assists);
 const yellow=numeric('yellow_cards',v.yellow),red=numeric('red_cards',v.red);
 const officialMinutes=numeric('minutes',v.minutes);
 const finalCoverage=canonical.minutesCoverage??canonical.minutes_coverage??null;
 const minuteCoverage=finalCoverage==='unavailable'?false:officialMinutes!==null&&officialMinutes>=0;
 const minutes=minuteCoverage?officialMinutes:null;
 const base=v.duration,pm=v.gfOn-v.gaOn;
 const totalsConsistent=games!=null&&starts!=null&&subentries!=null&&starts+subentries===games;
 const canonicalTotalsKnown=goals!=null&&assists!=null&&games!=null&&starts!=null;
 const timelineLoaded=source?.eventsLoaded!==false&&source?.playersLoaded!==false;
 const splitGames=timelineLoaded&&games===v.games&&starts===v.starts&&v.matches.length===v.games;
 const completeScoreTimelines=v.covered===v.games&&v.minutesKnown===v.games;
 const splitGoals=splitGames&&goals===v.goals;
 const splitAssists=splitGames&&assists===v.assists;
 const allMinutes=splitGames&&v.minutesKnown===v.games&&minuteCoverage&&v.minutes===minutes;
 const verifiedImpact=allMinutes&&v.covered===v.games;
 const hasOn=v.covered>0&&v.onMinutes>0;
 const impactComplete=verifiedImpact;
 const minuteSource=minuteCoverage?'Stessa fonte verificata della Rosa':'Minuti non verificabili';
 const safeRate=n=>minuteCoverage&&n!=null?rate(n,minutes,base):'—';
 const avg=a=>allMinutes&&a.length?number(a.reduce((x,y)=>x+y,0)/a.length)+'′':'—';
 const n=x=>x==null?'—':x;
 const title=(t,content)=>'<section class="psi-group"><div class="psi-head"><h2>'+E(t)+'</h2><span>Scorri per le altre metriche →</span></div><div class="psi-carousel" tabindex="0">'+content+'</div></section>';
 const coverage='Timeline punteggio verificata in '+v.covered+' / '+n(games)+' presenze. Le metriche on/off mostrano il campione verificato, senza estenderlo alle altre gare.';
 const intro='<div class="psi-summary">'+metric('Presenze',n(games),n(starts)+' titolare · '+(totalsConsistent?subentries:'N/D')+' subentrato')+metric('Minuti giocati',minuteCoverage?number(minutes)+'′':'—',minuteSource)+metric('Gol + assist',goals!=null&&assists!=null?goals+assists:'—',n(goals)+' gol · '+n(assists)+' assist')+metric('Plus/minus',hasOn?(pm>0?'+':'')+number(pm):'—',hasOn?v.covered+' gare verificate':'Copertura non completa')+'</div>';
 const use=title('Impiego',segment('Presenze e utilizzo',[
 ['Partite giocate',n(games)],['Titolare',n(starts)],['Subentrato',totalsConsistent?subentries:'—'],['Panchina inutilizzata',splitGames?v.unused:'—'],['Partite complete',allMinutes?v.fullGames:'—'],['Minuti per presenza',minuteCoverage&&games?number(minutes/games):'—'],['% titolarità',games&&starts!=null?number(starts/games*100)+'%':'—']])+segment('Ingressi e uscite', [['Minuto medio ingresso',avg(v.entryMinutes)],['Minuto medio uscita',avg(v.exitMinutes)],['Ingresso registrato',allMinutes?v.entryMinutes.length:'—'],['Uscita registrata',allMinutes?v.exitMinutes.length:'—']])+
 segment('Rendimento per tempo',[['Gol / '+base+"′",safeRate(goals)],['Assist / '+base+"′",safeRate(assists)],['Gol + assist / '+base+"′",safeRate(goals!=null&&assists!=null?goals+assists:null)],['Minuti / gol',goals&&minutes&&minuteCoverage?number(minutes/goals)+'′':'—'],['Minuti / G+A',goals!=null&&assists!=null&&(goals+assists)&&minutes&&minuteCoverage?number(minutes/(goals+assists))+'′':'—']], 'Il totale dei minuti proviene dalla stessa statistica visualizzata nella Rosa. Il plus/minus richiede invece una timeline verificabile.'));
 const attack=title('Produzione offensiva',segment('Gol e assist',[
 ['Gol',n(goals)],['Assist',n(assists)],['Gol da subentrato',goals===0?0:!splitGoals||!totalsConsistent?'—':v.subGoals],['Assist da subentrato',assists===0?0:!splitAssists||!totalsConsistent?'—':v.subAssists],['Doppiette',goals<=1&&goals!=null?0:!splitGoals?'—':v.braces],['Triplette',goals<=2&&goals!=null?0:!splitGoals?'—':v.hattricks],['% gol squadra',splitGoals&&splitGames&&v.teamGoalsDuringAppearances?number(goals/v.teamGoalsDuringAppearances*100)+'%':'—'],['% coinvolgimento',splitGoals&&splitAssists&&splitGames&&v.teamGoalsDuringAppearances?number((goals+assists)/v.teamGoalsDuringAppearances*100)+'%':'—']])+
 segment('Contesto delle reti',[['Apre le marcature',!splitGoals||!completeScoreTimelines?'—':v.firstGoals],['Gol del pareggio',!splitGoals||!completeScoreTimelines?'—':v.equalizers],['Gol del vantaggio',!splitGoals||!completeScoreTimelines?'—':v.leadGoals],['Gol in rimonta',!splitGoals||!completeScoreTimelines?'—':v.comeFromBehindGoals],['Gol potenzialmente decisivi',!splitGoals||!completeScoreTimelines?'—':v.goalWins]],'Gol decisivi: criterio descrittivo legato al punteggio finale, non una misura causale.'));
 const impact=title('Impatto in campo',segment('Differenza reti con il giocatore',[
 ['GF in campo',hasOn?v.gfOn:'—'],['GS in campo',hasOn?v.gaOn:'—'],['Plus/minus',hasOn?(pm>0?'+':'')+pm:'—'],['GF / '+base+"′",hasOn?rate(v.gfOn,v.onMinutes,base):'—'],['GS / '+base+"′",hasOn?rate(v.gaOn,v.onMinutes,base):'—'],['+/- / '+base+"′",hasOn?rate(pm,v.onMinutes,base):'—']],coverage)+
 segment('Dentro / fuori',[
 ['GF fuori campo',hasOn?v.gfOff:'—'],['GS fuori campo',hasOn?v.gaOff:'—'],['DR / '+base+"′ fuori",hasOn?rate(v.gfOff-v.gaOff,v.offMinutes,base):'—'],['Differenza on/off',hasOn&&v.onMinutes&&v.offMinutes?number(pm*base/v.onMinutes-(v.gfOff-v.gaOff)*base/v.offMinutes):'—'],['Clean sheet individuali',hasOn?v.cleanOn:'—'],['Gare verificate',v.covered]],'Confronto descrittivo: dipende anche da squadra, avversari e contesto.'));
 const outcomes=title('Risultati e disciplina',segment('Risultati delle presenze',[
 ['Vittorie',!splitGames?'—':v.results.W],['Pareggi',!splitGames?'—':v.results.D],['Sconfitte',!splitGames?'—':v.results.L],['Win rate',splitGames&&v.games?number(100*v.results.W/v.games)+'%':'—'],['Punti / gara',splitGames&&v.games?number((v.results.W*3+v.results.D)/v.games):'—']])+
 segment('Impatto del cambio e disciplina',[
 ['Punti con ingresso',!splitGames||!totalsConsistent?'—':v.subPoints],['Punti gare da titolare',!splitGames?'—':v.starterPoints],['Variazione punti dopo ingresso',hasOn?v.entryPointsDelta:'—'],['Variazione punti dopo uscita',hasOn?v.exitPointsDelta:'—'],['Ammonizioni',n(yellow)],['Espulsioni',n(red)]],'Le variazioni sono punti virtuali, non punti causalmente attribuiti al calciatore.'));
 const places=title('Casa e trasferta',segment('Rendimento per sede',[['Gare in casa',!splitGames?'—':v.home.games],['Gol in casa',goals===0?0:!splitGoals?'—':v.home.goals],['Assist in casa',assists===0?0:!splitAssists?'—':v.home.assists],['Punti / gara in casa',splitGames&&v.home.games?number(v.home.points/v.home.games):'—'],['Gare in trasferta',!splitGames?'—':v.away.games],['Gol in trasferta',goals===0?0:!splitGoals?'—':v.away.goals],['Assist in trasferta',assists===0?0:!splitAssists?'—':v.away.assists],['Punti / gara in trasferta',splitGames&&v.away.games?number(v.away.points/v.away.games):'—']]));
 const context=title('Distribuzioni','<article class="psi-slide"><h3>Stato del punteggio nei minuti giocati</h3>'+(hasOn?donut([['Vantaggio',v.states.leading],['Parità',v.states.drawing],['Svantaggio',v.states.trailing]]):'<p class="psi-note">Timeline non completamente verificata.</p>')+'</article>'+
 '<article class="psi-slide"><h3>Momento dei gol</h3>'+(splitGoals&&completeScoreTimelines?donut([['Primo tempo',v.goalsByPeriod[0]],['Secondo tempo',v.goalsByPeriod[1]]]):'<p class="psi-note">Distribuzione non verificata.</p>')+'</article>'+
 '<article class="psi-slide"><h3>Situazione prima del gol</h3>'+(splitGoals&&verifiedImpact?donut([['In vantaggio',v.goalsByContext[0]],['In parità',v.goalsByContext[1]],['In svantaggio',v.goalsByContext[2]]]):'<p class="psi-note">Sequenza non verificata.</p>')+'</article>');
 const trends=title('Andamento partita per partita','<article class="psi-slide"><h3>Plus/minus cumulativo</h3>'+lineChart(hasOn?v.trend.map(x=>x.value):[],v.trend.map(x=>x.label),'Andamento plus/minus')+'</article>'+
 '<article class="psi-slide"><h3>Minuti per partita</h3>'+lineChart(allMinutes?v.matches.map(x=>x.minutes):[],v.matches.map(x=>x.label),'Minuti giocati')+'</article>'+
 '<article class="psi-slide"><h3>Gol e assist per partita</h3>'+lineChart(splitGoals&&splitAssists?v.matches.map(x=>x.goals+x.assists):[],v.matches.map(x=>x.label),'Partecipazioni al gol')+'</article>');
 return '<div class="psi-root"><p class="psi-subtitle">Analisi stagionale · statistiche descrittive calcolate dai tabellini</p>'+intro+use+attack+impact+outcomes+places+context+trends+'<p class="psi-disclaimer">'+E(coverage)+' Presenze, titolarità, subentri, minuti, gol, assist e disciplina derivano dalla stessa vista SQL della Rosa; le distribuzioni avanzate richiedono eventi completi. I grafici con copertura parziale non sono una certificazione dei minuti.</p></div>';
}
