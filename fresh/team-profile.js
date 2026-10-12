const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number(v)||0));
const pct=(a,b)=>b?clamp(a/b):null;
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0;
const variance=a=>{if(!a.length)return 0;const m=mean(a);return a.reduce((s,x)=>s+(x-m)*(x-m),0)/a.length};

export function confidenceLevel({resultMatches=0,timelineMatches=0,eventMatches=0}={}){
 const result=clamp(resultMatches/5);
 const timeline=clamp(timelineMatches/5);
 const events=clamp(eventMatches/6);
 return {
  A:{level:'A',score:result,label:resultMatches>=5?'solida':resultMatches>=3?'discreta':'iniziale',sample:resultMatches},
  B:{level:'B',score:timeline,label:timelineMatches>=5?'solida':timelineMatches>=2?'discreta':'limitata',sample:timelineMatches},
  C:{level:'C',score:events,label:eventMatches>=6?'discreta':eventMatches>=3?'limitata':'esplorativa',sample:eventMatches}
 };
}

export function buildTeamProfile({numbers={},gameState={},eventMatches=0}={}){
 const matches=[...(numbers.matches||[])];
 const played=Number(numbers.played)||matches.length||0;
 const gf=Number(numbers.gf)||0,ga=Number(numbers.ga)||0;
 const goalsFor=matches.map(x=>Number(x.goals)||0),goalsAgainst=matches.map(x=>Number(x.conceded)||0);
 const totalGoals=matches.map((x,i)=>goalsFor[i]+goalsAgainst[i]);
 const margins=matches.map((x,i)=>goalsFor[i]-goalsAgainst[i]);
 const recent=matches.slice(-5);
 let recentWeighted=0,recentWeights=0;
 recent.forEach((m,i)=>{const w=i+1;recentWeighted+=w*(m.result==='W'?1:m.result==='D'?.5:0);recentWeights+=w});
 const resultConfidence=confidenceLevel({resultMatches:played,timelineMatches:Number(gameState.matches)||0,eventMatches});
 const gfpg=played?gf/played:0,gapg=played?ga/played:0;
 const failToScore=played?goalsFor.filter(x=>x===0).length/played:null;
 const cleanSheet=played?(Number(numbers.cleanSheets)||0)/played:null;
 const openRate=played?totalGoals.filter(x=>x>=3).length/played:null;
 const tightRate=played?margins.filter(x=>Math.abs(x)<=1).length/played:null;
 const bigWinRate=played?margins.filter(x=>x>=2).length/played:null;
 const bigLossRate=played?margins.filter(x=>x<=-2).length/played:null;
 const volatility=played>=2?Math.sqrt(variance(margins)):null;
 const homePpg=numbers.home?.played?(Number(numbers.home.wins||0)+.5*Number(numbers.home.draws||0))/numbers.home.played:null;
 const awayPpg=numbers.away?.played?(Number(numbers.away.wins||0)+.5*Number(numbers.away.draws||0))/numbers.away.played:null;
 const role=(side,k)=>Number(gameState.roles?.[side]?.[k])||0;
 const timeline=Math.max(0,Number(gameState.matches)||0);
 const metrics=[
  {key:'form',label:'Forma recente',value:recentWeights?recentWeighted/recentWeights:.5,confidence:'A',sample:recent.length},
  {key:'attack',label:'Produzione offensiva',value:clamp(gfpg/2.5),raw:gfpg,confidence:'A',sample:played},
  {key:'defense',label:'Tenuta difensiva',value:clamp(1-gapg/2.5),raw:gapg,confidence:'A',sample:played},
  {key:'clean-sheet',label:'Clean sheet',value:cleanSheet,confidence:'A',sample:played},
  {key:'fail-to-score',label:'Continuità nel segnare',value:failToScore==null?null:1-failToScore,confidence:'A',sample:played},
  {key:'open-games',label:'Propensione a gare aperte',value:openRate,confidence:'A',sample:played},
  {key:'tight-games',label:'Gare decise entro un gol',value:tightRate,confidence:'A',sample:played},
  {key:'big-wins',label:'Vittorie larghe',value:bigWinRate,confidence:'A',sample:played},
  {key:'big-losses',label:'Sconfitte larghe',value:bigLossRate==null?null:1-bigLossRate,confidence:'A',sample:played},
  {key:'stability',label:'Stabilità del margine',value:volatility==null?null:clamp(1-volatility/3),raw:volatility,confidence:'A',sample:played},
  {key:'home-away',label:'Adattabilità casa/trasferta',value:homePpg==null||awayPpg==null?null:clamp(1-Math.abs(homePpg-awayPpg)),raw:homePpg==null||awayPpg==null?null:homePpg-awayPpg,confidence:'A',sample:played},
  {key:'lead-hold',label:'Tenuta del vantaggio',value:gameState.leadHoldRate,confidence:'B',sample:timeline},
  {key:'recovery',label:'Recupero dallo svantaggio',value:gameState.recoveryRate,confidence:'B',sample:timeline},
  {key:'equalizers',label:'Capacità di pareggiare',value:timeline?clamp(role('team','equalizer')/timeline):null,confidence:'B',sample:timeline},
  {key:'reduce-deficit',label:'Capacità di riaprire',value:timeline?clamp(role('team','deficit_reduction')/timeline):null,confidence:'B',sample:timeline},
  {key:'protect-multi-goal',label:'Protezione vantaggi larghi',value:timeline?clamp(1-role('opponent','deficit_reduction')/timeline):null,confidence:'B',sample:timeline},
  {key:'quick-response',label:'Reazione entro 10′',value:timeline?clamp((Number(gameState.quickResponsesFor)||0)/timeline):null,confidence:'C',sample:timeline},
  {key:'post-goal-stability',label:'Tenuta nei 10′ dopo un gol',value:timeline?clamp(1-(Number(gameState.quickResponsesAgainst)||0)/timeline):null,confidence:'C',sample:timeline}
 ];
 const available=metrics.filter(x=>Number.isFinite(Number(x.value)));
 const overall=available.length?available.reduce((s,x)=>{
  const conf=resultConfidence[x.confidence]?.score??0;
  const weight=x.confidence==='A'?1:x.confidence==='B'?.65:.35;
  return s+Number(x.value)*weight*(.35+.65*conf);
 },0)/available.reduce((s,x)=>{
  const conf=resultConfidence[x.confidence]?.score??0;
  const weight=x.confidence==='A'?1:x.confidence==='B'?.65:.35;
  return s+weight*(.35+.65*conf);
 },0):.5;
 return {
  overall:clamp(overall),played,gfpg,gapg,failToScore,cleanSheet,openRate,tightRate,bigWinRate,bigLossRate,volatility,
  homePpg,awayPpg,metrics,confidence:resultConfidence,
  timelineCoverage:played?timeline/played:0
 };
}

export function profileHighlights(profile,limit=5){
 const candidates=(profile?.metrics||[]).filter(x=>Number.isFinite(Number(x.value))&&x.sample>0);
 return candidates.map(x=>({...x,distance:Math.abs(Number(x.value)-.5)}))
  .filter(x=>x.distance>=.12)
  .sort((a,b)=>b.distance-a.distance||({A:0,B:1,C:2}[a.confidence]-({A:0,B:1,C:2}[b.confidence])))
  .slice(0,limit);
}
