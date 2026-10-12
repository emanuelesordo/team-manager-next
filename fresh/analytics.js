import {cumulativeEventMinute} from './match-minutes.js';
import {analyseGoalTimeline,mergeGameStateAnalyses} from './game-state.js';

const key=v=>String(v??'');
const isTeam=(f,side,team)=>Boolean(team?.id&&key(f?.[side+'_team_id'])===key(team.id));
const goalTypes=new Set(['goal','penalty_goal','penalty_scored','own_goal']);
const acceptedEvent=e=>e?.validation_status!=='rejected';
const goalEvent=e=>goalTypes.has(e?.event_type)&&e?.payload?.count_score!==false;

export const isPlayed=f=>f?.status==='finished'&&Number.isInteger(f.home_score)&&Number.isInteger(f.away_score);

export function resultSplit(fixtures,team){
 const result={played:0,wins:0,draws:0,losses:0,gf:0,ga:0,cleanSheets:0,home:{played:0,wins:0,draws:0,losses:0,gf:0,ga:0},away:{played:0,wins:0,draws:0,losses:0,gf:0,ga:0}};
 for(const f of fixtures){
  if(!isPlayed(f))continue;
  const atHome=isTeam(f,'home',team),atAway=isTeam(f,'away',team);
  if(atHome===atAway)continue;
  const gf=atHome?f.home_score:f.away_score,ga=atHome?f.away_score:f.home_score;
  const part=atHome?result.home:result.away;
  for(const row of [result,part]){
   row.played++;row.gf+=gf;row.ga+=ga;
   row[gf>ga?'wins':gf<ga?'losses':'draws']++;
  }
  if(ga===0)result.cleanSheets++;
 }
 return result;
}

/* Le statistiche stagionali seguono la sorgente storica di team-manager:
   gare concluse + tutti gli eventi registrati salvo quelli esplicitamente rifiutati.
   La validazione completa viene richiesta solo per le metriche che dipendono
   dall'ordine esatto della timeline (rimonte/situazione del punteggio). */
export function seasonNumbers(fixtures,matches,events,team,competitions=[],playerStats=[]){
 const split=resultSplit(fixtures,team);
 const fixtureById=new Map((fixtures||[]).filter(isPlayed).map(f=>[key(f.id),f]));
 const matchById=new Map((matches||[]).map(m=>[key(m.id),m]));
 const fixtureForMatch=m=>fixtureById.get(key(m?.fixture_id));
 const validMatchIds=new Set([...matchById].filter(([,m])=>fixtureForMatch(m)).map(([id])=>id));
 const rows=(events||[]).filter(e=>validMatchIds.has(key(e.match_id))&&acceptedEvent(e));
 const totals={...split,substitutions:0,yellows:0,blues:0,reds:0,opponentReds:0,assists:0,
  goalsByPeriod:[0,0],concededByPeriod:[0,0],goalIntervals:[0,0,0,0],
  matches:[],players:playerStats||[]};

 for(const f of fixtureById.values()){
  const home=isTeam(f,'home',team),gf=home?f.home_score:f.away_score,ga=home?f.away_score:f.home_score;
  totals.matches.push({id:f.id,kickoff_at:f.kickoff_at,opponent_id:home?f.away_opponent_id:f.home_opponent_id,
   goals:gf,conceded:ga,result:gf>ga?'W':gf<ga?'L':'D',home_away:home?'home':'away'});
 }

 const sideFor=e=>{
  if(e.team_side==='team')return 'team';
  if(e.team_side==='opponent')return 'opponent';
  const m=matchById.get(key(e.match_id)),f=fixtureForMatch(m);
  if(!f)return null;
  const home=isTeam(f,'home',team);
  if(e.side==='home')return home?'team':'opponent';
  if(e.side==='away')return home?'opponent':'team';
  return null;
 };
 const scoringSide=e=>{
  let side=sideFor(e);
  if(e.event_type==='own_goal')side=side==='team'?'opponent':side==='opponent'?'team':side;
  return side;
 };
 const competitionFor=e=>{
  const m=matchById.get(key(e.match_id)),f=fixtureForMatch(m);
  return competitions.find(c=>key(c.id)===key(f?.competition_id||m?.competition_id))||null;
 };
 const periodIndex=e=>{
  const c=competitionFor(e),half=Math.max(1,Number(c?.minutes_per_period)||45);
  const explicit=e.payload?.period;
  if(explicit==='second_half'||Number(e.payload?.period_no)===2)return 1;
  if(explicit==='first_half'||Number(e.payload?.period_no)===1)return 0;
  const cumulative=cumulativeEventMinute(e,c);
  return cumulative!=null&&cumulative>half?1:0;
 };
 const intervalIndex=e=>{
  const c=competitionFor(e),half=Math.max(1,Number(c?.minutes_per_period)||45);
  const period=periodIndex(e);
  let relative=Number(e.minute);
  if(!Number.isFinite(relative))return period*2;
  if(relative>half)relative-=period*half;
  return period*2+(relative>half/2?1:0);
 };

 for(const e of rows){
  const side=sideFor(e);
  if(e.event_type==='substitution'&&side==='team')totals.substitutions++;
  if(side==='team'){
   if(e.event_type==='yellow_card')totals.yellows++;
   if(e.event_type==='blue_card')totals.blues++;
   if(e.event_type==='red_card'||e.event_type==='second_yellow')totals.reds++;
  }
  if(side==='opponent'&&(e.event_type==='red_card'||e.event_type==='second_yellow'))totals.opponentReds++;
  if(goalEvent(e)){
   const scoreSide=scoringSide(e),p=periodIndex(e);
   if(scoreSide==='team'){
    totals.goalsByPeriod[p]++;
    totals.goalIntervals[intervalIndex(e)]++;
    if(e.secondary_player_id!=null&&key(e.secondary_player_id)!==key(e.player_id))totals.assists++;
   }else if(scoreSide==='opponent')totals.concededByPeriod[p]++;
  }
 }
 totals.matches.sort((a,b)=>new Date(a.kickoff_at)-new Date(b.kickoff_at));
 return totals;
}


export function aggregatePlayerMinutes(matches=[],matchPlayers=[],events=[],competitions=[]){
 const totals=new Map(),matchById=new Map((matches||[]).map(m=>[key(m.id),m]));
 const byMatchPlayers=new Map(),byMatchEvents=new Map();
 for(const row of matchPlayers||[]){
  const id=key(row.match_id);if(!matchById.has(id))continue;
  const list=byMatchPlayers.get(id)||[];list.push(row);byMatchPlayers.set(id,list);
 }
 for(const e of events||[]){
  const id=key(e.match_id);if(!matchById.has(id)||!acceptedEvent(e))continue;
  const list=byMatchEvents.get(id)||[];list.push(e);byMatchEvents.set(id,list);
 }
 const add=(id,n)=>{if(id==null)return;const k=key(id);totals.set(k,(totals.get(k)||0)+Math.max(0,n||0));};
 for(const match of matches||[]){
  const mid=key(match.id),players=byMatchPlayers.get(mid)||[],rows=byMatchEvents.get(mid)||[];
  if(!players.length)continue;
  const competition=competitions.find(c=>key(c.id)===key(match.competition_id))||null;
  const half=Math.max(1,Number(competition?.minutes_per_period)||45);
  const recovery=period=>{
   const found=[...rows].filter(e=>e.event_type==='period_end'&&(e.payload?.period===period||Number(e.payload?.period_no)===(period==='first_half'?1:2))).at(-1);
   const value=found?.payload?.recovery_minutes??found?.payload?.recovery_actual??found?.stoppage_minute;
   return Number.isFinite(Number(value))?Math.max(0,Number(value)):0;
  };
  const rec1=recovery('first_half'),rec2=recovery('second_half'),end=half*2+rec1+rec2;
  const elapsed=e=>{
   if(e?.minute==null)return null;
   const minute=Number(e.minute);if(!Number.isFinite(minute))return null;
   const stoppage=Math.max(0,Number(e.stoppage_minute)||0),period=e.payload?.period;
   if(period==='halftime')return Math.min(end,half+rec1);
   const legacySecond=period==='second_half'&&e.payload?.minute_relative!==false&&e.payload?.entered_from!=='tm_app_live';
   let value=legacySecond?half+rec1+minute:minute+(period==='second_half'||minute>half?rec1:0);
   if(stoppage>0)value+=stoppage;
   return Math.max(0,Math.min(end,value));
  };
  const active=new Set(players.filter(p=>p.started).map(p=>key(p.player_id)));
  const durations=new Map([...active].map(id=>[id,0]));
  const timeline=rows.filter(e=>['substitution','red_card','second_yellow'].includes(e.event_type)&&e.minute!=null)
   .map(e=>({e,t:elapsed(e)})).filter(x=>x.t!=null)
   .sort((a,b)=>a.t-b.t||String(a.e.created_at||'').localeCompare(String(b.e.created_at||'')));
  let cursor=0;
  for(const {e,t} of timeline){
   const at=Math.max(cursor,Math.min(end,t)),delta=at-cursor;
   active.forEach(id=>durations.set(id,(durations.get(id)||0)+delta));
   if(e.event_type==='substitution'){
    if(e.player_id!=null)active.delete(key(e.player_id));
    if(e.secondary_player_id!=null){
     const id=key(e.secondary_player_id);active.add(id);
     if(!durations.has(id))durations.set(id,0);
    }
   }else if(e.player_id!=null)active.delete(key(e.player_id));
   cursor=at;
  }
  active.forEach(id=>durations.set(id,(durations.get(id)||0)+Math.max(0,end-cursor)));
  durations.forEach((minutes,id)=>add(id,Math.round(minutes)));
 }
 return totals;
}

export function verifiedEvents(events){
 return (events||[]).filter(e=>['official','community_confirmed'].includes(e.validation_status));
}

export function eventCoverage(fixtures,matches,events,team,competitions=[]){
 const map=new Map(matches.map(m=>[m.id,m]));
 const eventsByMatch=new Map();
 for(const event of verifiedEvents(events)){
  const list=eventsByMatch.get(event.match_id)||[];list.push(event);eventsByMatch.set(event.match_id,list);
 }
 let complete=0,possible=0,unverified=0,withoutMinutes=0,comebacks=0,concededComebacks=0,comebackWins=0;
 const location={equal:0,ahead:0,behind:0},conceded={equal:0,ahead:0,behind:0},gameStates=[];
 const halftime={sample:0,leading:{matches:0,wins:0,draws:0,losses:0},drawing:{matches:0,wins:0,draws:0,losses:0},trailing:{matches:0,wins:0,draws:0,losses:0}};
 for(const f of fixtures){
  if(!isPlayed(f)||(!isTeam(f,'home',team)&&!isTeam(f,'away',team)))continue;
  const m=matches.find(x=>x.fixture_id===f.id&&map.get(x.id)===x);
  if(!m)continue;
  possible++;
  const periodRows=eventsByMatch.get(m.id)||[];
  const halfRow=periodRows.find(e=>e.event_type==='period_end'&&(e.payload?.period==='first_half'||Number(e.payload?.period_no)===1)&&e.payload?.score_home!=null&&e.payload?.score_away!=null);
  if(halfRow){
   const h=Number(halfRow.payload.score_home),a=Number(halfRow.payload.score_away);
   if(Number.isInteger(h)&&Number.isInteger(a)&&h>=0&&a>=0){
    const htFor=isTeam(f,'home',team)?h:a,htAgainst=isTeam(f,'home',team)?a:h;
    const label=htFor>htAgainst?'leading':htFor<htAgainst?'trailing':'drawing';
    const fullFor=isTeam(f,'home',team)?f.home_score:f.away_score;
    const fullAgainst=isTeam(f,'home',team)?f.away_score:f.home_score;
    halftime.sample++;halftime[label].matches++;
    halftime[label][fullFor>fullAgainst?'wins':fullFor<fullAgainst?'losses':'draws']++;
   }
  }
  const rows=periodRows.filter(e=>goalEvent(e));
  const expected=f.home_score+f.away_score;
  if(rows.length!==expected){unverified++;continue}
  if(rows.some(e=>!Number.isInteger(e.minute))){withoutMinutes++;continue}
  const competition=competitions.find(c=>c.id===f.competition_id)||null;
  rows.sort((a,b)=>(cumulativeEventMinute(a,competition)??999)-(cumulativeEventMinute(b,competition)??999)||(a.stoppage_minute||0)-(b.stoppage_minute||0)||String(a.created_at).localeCompare(String(b.created_at)));
  let teamGoals=0,oppGoals=0,wasBehind=false,wasAhead=false,positive=false,negative=false;
  const localFor={equal:0,ahead:0,behind:0},localAgainst={equal:0,ahead:0,behind:0};
  let ambiguousSide=false;
  for(const e of rows){
   let eventSide=e.team_side;
   if(e.event_type==='own_goal')eventSide=eventSide==='team'?'opponent':eventSide==='opponent'?'team':eventSide;
   if(!['team','opponent'].includes(eventSide)){ambiguousSide=true;break}
   const before=teamGoals-oppGoals,bucket=before>0?'ahead':before<0?'behind':'equal';
   (eventSide==='team'?localFor:localAgainst)[bucket]++;
   if(before<0)wasBehind=true;if(before>0)wasAhead=true;
   if(eventSide==='team')teamGoals++;else oppGoals++;
   const after=teamGoals-oppGoals;
   if(wasBehind&&after>=0)positive=true;
   if(wasAhead&&after<=0)negative=true;
  }
  const officialFor=isTeam(f,'home',team)?f.home_score:f.away_score;
  const officialAgainst=isTeam(f,'home',team)?f.away_score:f.home_score;
  if(ambiguousSide||teamGoals!==officialFor||oppGoals!==officialAgainst){unverified++;continue}
  for(const k of ['equal','ahead','behind']){location[k]+=localFor[k];conceded[k]+=localAgainst[k]}
  const allRows=eventsByMatch.get(m.id)||[];
  const baseDuration=Math.max(1,Number(competition?.periods||2))*Math.max(1,Number(competition?.minutes_per_period||40));
  const recovery=allRows.filter(e=>e.event_type==='period_end').reduce((sum,e)=>{
   const n=Number(e.payload?.recovery_actual??e.payload?.recovery_minutes??e.stoppage_minute);
   return sum+(Number.isFinite(n)&&n>0?n:0);
  },0);
  gameStates.push(analyseGoalTimeline(rows,{
   sideOf:e=>{let side=e.team_side;if(e.event_type==='own_goal')side=side==='team'?'opponent':side==='opponent'?'team':side;return side},
   minuteOf:e=>cumulativeEventMinute(e,competition),
   duration:baseDuration+recovery,responseWindow:10
  }));
  complete++;if(positive)comebacks++;if(negative)concededComebacks++;
  if(positive&&teamGoals>oppGoals)comebackWins++;
 }
 return {possible,complete,unverified,withoutMinutes,goalSituations:location,concededSituations:conceded,comebacks,concededComebacks,comebackWins,halftime,gameState:mergeGameStateAnalyses(gameStates)};
}
