// Shared score-state analysis for completed goal timelines.
// All labels are normalized from the analysed team's point of view.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const stateOf=(forGoals,againstGoals)=>forGoals>againstGoals?'leading':forGoals<againstGoals?'trailing':'drawing';

export function goalRole(beforeFor,beforeAgainst,scorer){
 const diff=beforeFor-beforeAgainst;
 const nil=beforeFor===0&&beforeAgainst===0;
 if(scorer==='team'){
  if(nil)return 'opener';
  if(diff===0)return 'go_ahead';
  if(diff<0)return beforeFor+1===beforeAgainst?'equalizer':'deficit_reduction';
  return 'lead_extension';
 }
 if(nil)return 'opener';
 if(diff===0)return 'go_ahead';
 if(diff>0)return beforeAgainst+1===beforeFor?'equalizer':'deficit_reduction';
 return 'lead_extension';
}

export function analyseGoalTimeline(goals,{sideOf,minuteOf,duration=80,responseWindow=10}={}){
 const ordered=(goals||[]).map((event,index)=>({
  event,index,side:sideOf?.(event),minute:Number(minuteOf?.(event))
 })).filter(x=>['team','opponent'].includes(x.side)&&Number.isFinite(x.minute))
  .sort((a,b)=>a.minute-b.minute||a.index-b.index);
 const total=Math.max(1,Number(duration)||80);
 const stateMinutes={leading:0,drawing:0,trailing:0};
 const roles={
  team:{opener:0,go_ahead:0,equalizer:0,deficit_reduction:0,lead_extension:0},
  opponent:{opener:0,go_ahead:0,equalizer:0,deficit_reduction:0,lead_extension:0}
 };
 const byState={
  scored:{leading:0,drawing:0,trailing:0},
  conceded:{leading:0,drawing:0,trailing:0}
 };
 let gf=0,ga=0,cursor=0,firstScorer=null,maxLead=0,maxDeficit=0;
 let leadsTaken=0,leadsLost=0,trailsEntered=0,trailsRecovered=0;
 let quickResponsesFor=0,quickResponsesAgainst=0;
 const events=[];
 let previous=null;
 for(const row of ordered){
  const minute=clamp(row.minute,0,total),state=stateOf(gf,ga);
  stateMinutes[state]+=Math.max(0,minute-cursor);
  const before={for:gf,against:ga,diff:gf-ga,state};
  const role=goalRole(gf,ga,row.side);
  roles[row.side][role]++;
  (row.side==='team'?byState.scored:byState.conceded)[state]++;
  if(!firstScorer)firstScorer=row.side;
  const switched=previous&&previous.side!==row.side;
  const delta=switched?Math.max(0,minute-previous.minute):null;
  if(switched&&delta<=responseWindow){
   if(row.side==='team')quickResponsesFor++;
   else quickResponsesAgainst++;
  }
  if(row.side==='team')gf++;else ga++;
  const after={for:gf,against:ga,diff:gf-ga,state:stateOf(gf,ga)};
  if(before.state!=='leading'&&after.state==='leading')leadsTaken++;
  if(before.state==='leading'&&after.state!=='leading')leadsLost++;
  if(before.state!=='trailing'&&after.state==='trailing')trailsEntered++;
  if(before.state==='trailing'&&after.state!=='trailing')trailsRecovered++;
  maxLead=Math.max(maxLead,gf-ga);
  maxDeficit=Math.max(maxDeficit,ga-gf);
  events.push({minute,rowSide:row.side,role,before,after,responseMinutes:delta});
  cursor=minute;previous=row;
 }
 stateMinutes[stateOf(gf,ga)]+=Math.max(0,total-cursor);
 const pct=Object.fromEntries(Object.entries(stateMinutes).map(([k,v])=>[k,v/total]));
 return {
  complete:ordered.length===(goals||[]).length,goalsFor:gf,goalsAgainst:ga,firstScorer,
  stateMinutes,stateShare:pct,roles,byState,maxLead,maxDeficit,
  leadsTaken,leadsLost,trailsEntered,trailsRecovered,
  quickResponsesFor,quickResponsesAgainst,responseWindow,events,duration:total
 };
}

export function mergeGameStateAnalyses(rows=[]){
 const out={
  matches:0,stateMinutes:{leading:0,drawing:0,trailing:0},duration:0,
  roles:{team:{opener:0,go_ahead:0,equalizer:0,deficit_reduction:0,lead_extension:0},
   opponent:{opener:0,go_ahead:0,equalizer:0,deficit_reduction:0,lead_extension:0}},
  byState:{scored:{leading:0,drawing:0,trailing:0},conceded:{leading:0,drawing:0,trailing:0}},
  firstScored:0,firstConceded:0,leadsTaken:0,leadsLost:0,trailsEntered:0,trailsRecovered:0,
  quickResponsesFor:0,quickResponsesAgainst:0,maxDeficitRecovered:0
 };
 for(const x of rows||[]){
  if(!x)continue;out.matches++;out.duration+=x.duration||0;
  for(const s of ['leading','drawing','trailing']){
   out.stateMinutes[s]+=x.stateMinutes?.[s]||0;
   out.byState.scored[s]+=x.byState?.scored?.[s]||0;
   out.byState.conceded[s]+=x.byState?.conceded?.[s]||0;
  }
  for(const side of ['team','opponent'])for(const role of ['opener','go_ahead','equalizer','deficit_reduction','lead_extension'])
   out.roles[side][role]+=x.roles?.[side]?.[role]||0;
  if(x.firstScorer==='team')out.firstScored++;else if(x.firstScorer==='opponent')out.firstConceded++;
  out.leadsTaken+=x.leadsTaken||0;out.leadsLost+=x.leadsLost||0;
  out.trailsEntered+=x.trailsEntered||0;out.trailsRecovered+=x.trailsRecovered||0;
  out.quickResponsesFor+=x.quickResponsesFor||0;out.quickResponsesAgainst+=x.quickResponsesAgainst||0;
  if((x.trailsRecovered||0)>0)out.maxDeficitRecovered=Math.max(out.maxDeficitRecovered,x.maxDeficit||0);
 }
 out.stateShare=Object.fromEntries(Object.entries(out.stateMinutes).map(([k,v])=>[k,out.duration?v/out.duration:0]));
 out.leadHoldRate=out.leadsTaken?1-out.leadsLost/out.leadsTaken:null;
 out.recoveryRate=out.trailsEntered?out.trailsRecovered/out.trailsEntered:null;
 return out;
}
