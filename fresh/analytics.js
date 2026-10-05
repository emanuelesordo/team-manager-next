import {cumulativeEventMinute} from './match-minutes.js';

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
 const totals={...split,substitutions:0,yellows:0,blues:0,reds:0,assists:0,
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
 const location={equal:0,ahead:0,behind:0},conceded={equal:0,ahead:0,behind:0};
 for(const f of fixtures){
  if(!isPlayed(f)||(!isTeam(f,'home',team)&&!isTeam(f,'away',team)))continue;
  const m=matches.find(x=>x.fixture_id===f.id&&map.get(x.id)===x);
  if(!m)continue;
  possible++;
  const rows=(eventsByMatch.get(m.id)||[]).filter(e=>goalEvent(e));
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
  complete++;if(positive)comebacks++;if(negative)concededComebacks++;
  if(positive&&teamGoals>oppGoals)comebackWins++;
 }
 return {possible,complete,unverified,withoutMinutes,goalSituations:location,concededSituations:conceded,comebacks,concededComebacks,comebackWins};
}
