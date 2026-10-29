/* Deterministic, state-dependent match simulations. No future match data. */
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const hash=s=>{let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
const rngFor=seed=>{let x=hash(seed)||1;return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296}};
const windowsFor=(situ,duration)=>Array.from({length:4},(_,i)=>{
 const a=(situ?.goalWindows||[]).find(w=>Math.abs(Number(w.start)-(1+i*duration/4))<=3);
 return {for:Number(a?.for||0),against:Number(a?.against||0)};
});
function temporalShares(situ,duration,kind){
 const rows=windowsFor(situ,duration),sample=Number(situ?.timelineSample||0);
 const priors=rows.map(r=>r[kind]+Math.max(1.5,4-sample*.15));
 const sum=priors.reduce((a,b)=>a+b,0);
 return priors.map(v=>v/sum);
}
// Bayesian shrinkage: reaction patterns are used only when observed in complete timelines.
function responseMultiplier(own,opponent,minutesSinceConceded,minutesSinceScored){
 const a=own?.gameState||{},b=opponent?.gameState||{};
 const observations=Math.min(Number(a.matches)||0,Number(b.matches)||0);
 const trust=clamp(observations/(observations+6),0,.60);
 if(!trust)return 1;
 const quickFor=(Number(a.quickResponsesFor)||0)/(Math.max(1,Number(a.matches)||0));
 const quickAgainst=(Number(b.quickResponsesAgainst)||0)/(Math.max(1,Number(b.matches)||0));
 const ownVulnerability=(Number(a.quickResponsesAgainst)||0)/Math.max(1,Number(a.matches)||0);
 const oppReactions=(Number(b.quickResponsesFor)||0)/Math.max(1,Number(b.matches)||0);
 let effect=0;
 if(minutesSinceConceded!==null&&minutesSinceConceded<=10){
  effect+=clamp((quickFor+quickAgainst)*.5-.25,-.25,.65)*(1-minutesSinceConceded/14);
 }
 if(minutesSinceScored!==null&&minutesSinceScored<=10){
  effect+=clamp((ownVulnerability+oppReactions)*.5-.25,-.25,.65)*(1-minutesSinceScored/14);
 }
 return clamp(1+effect*trust,.87,1.28);
}
function stateMultiplier(own,other,score){
 if(score===0)return 1;
 const n=Math.min(3,Math.abs(score));
 if(score<0){
  const base=own?.recoveryRate;
  const recover=Number.isFinite(base)?clamp((base*Number(own.trailed||0)+1)/(Number(own.trailed||0)+3),.2,.85):.5;
  const resistance=other?.leadHoldRate;
  const hold=Number.isFinite(resistance)?clamp((resistance*Number(other.led||0)+1)/(Number(other.led||0)+3),.2,.85):.5;
  return clamp(1+n*(.13+.27*(recover-.5)-.20*(hold-.5)),.75,1.75);
 }
 const hold=own?.leadHoldRate;
 const stable=Number.isFinite(hold)?clamp((hold*Number(own.led||0)+1)/(Number(own.led||0)+3),.2,.85):.5;
 return clamp(1-n*(.11+.10*(stable-.5)),.60,1.06);
}
export function simulateScoreTimeline({fixtureId,homeLambda,awayLambda,homeSituational={},awaySituational={},duration=80,trials=2400}={}){
 const rng=rngFor(fixtureId+'|timeline-v2|'+homeLambda.toFixed(5)+'|'+awayLambda.toFixed(5)+
  '|'+JSON.stringify([homeSituational.goalWindows,awaySituational.goalWindows,homeSituational.recoveryRate,awaySituational.recoveryRate,homeSituational.gameState,awaySituational.gameState]));
 const homeAttack=temporalShares(homeSituational,duration,'for');
 const awayAttack=temporalShares(awaySituational,duration,'for');
 const homeDefense=temporalShares(homeSituational,duration,'against');
 const awayDefense=temporalShares(awaySituational,duration,'against');
 const blend=(attack,defense)=>attack.map((v,i)=>Math.sqrt(v*defense[i]));
 const h=blend(homeAttack,awayDefense),a=blend(awayAttack,homeDefense);
 const normalize=arr=>{const sum=arr.reduce((x,y)=>x+y,0);return arr.map(v=>v/sum)};
 const weightsHome=normalize(h),weightsAway=normalize(a);
 const counts=new Map(),runs=[];
 const steps=Math.max(40,Math.min(120,Math.round(duration)));
 for(let run=0;run<trials;run++){
  let home=0,away=0;const events=[];let lastHomeGoal=null,lastAwayGoal=null;
  for(let minute=1;minute<=steps;minute++){
   const bucket=Math.min(3,Math.floor((minute-1)*4/steps));
   // Conditional hazards respond to the current score after every event.
   const homeHazard=clamp(homeLambda*weightsHome[bucket]*4/steps*
    stateMultiplier(homeSituational,awaySituational,home-away)*\n    responseMultiplier(homeSituational,awaySituational,lastAwayGoal===null?null:minute-lastAwayGoal,lastHomeGoal===null?null:minute-lastHomeGoal),0,.35);
   const awayHazard=clamp(awayLambda*weightsAway[bucket]*4/steps*
    stateMultiplier(awaySituational,homeSituational,away-home)*\n    responseMultiplier(awaySituational,homeSituational,lastHomeGoal===null?null:minute-lastHomeGoal,lastAwayGoal===null?null:minute-lastAwayGoal),0,.35);
   // Sequential draws allow the second side to react to the updated score.
   if(rng()<1-Math.exp(-homeHazard)){home++;lastHomeGoal=minute;events.push({minute,side:'home',type:'goal'})}
   if(rng()<1-Math.exp(-awayHazard)){away++;lastAwayGoal=minute;events.push({minute,side:'away',type:'goal'})}
  }
  const key=home+'-'+away;counts.set(key,(counts.get(key)||0)+1);runs.push({home,away,events});
 }
 const lines=[...counts].map(([score,count])=>{const [home,away]=score.split('-').map(Number);return {home,away,probability:count/trials}})
  .sort((x,y)=>y.probability-x.probability||x.home+x.away-y.home-y.away||x.home-y.home);
 const main=lines[0]||{home:0,away:0,probability:1};
 const representative=runs.find(r=>r.home===main.home&&r.away===main.away)||runs[0];
 const hWin=runs.filter(r=>r.home>r.away).length/trials,aWin=runs.filter(r=>r.home<r.away).length/trials;
 return {probabilities:{home:hWin,draw:1-hWin-aWin,away:aWin,mostLikely:main,topScorelines:lines.slice(0,3)},
  sampleTimeline:representative.events,simulations:trials,
  expectedGoals:{home:runs.reduce((v,r)=>v+r.home,0)/trials,away:runs.reduce((v,r)=>v+r.away,0)/trials},
  evidence:{homeTimelineSample:homeSituational.timelineSample||0,awayTimelineSample:awaySituational.timelineSample||0}};
}
