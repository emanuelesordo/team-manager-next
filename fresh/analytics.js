import {normalized} from './domain.js';
const isTeam=(name,team)=>normalized(name)===normalized(team.name)||normalized(name)===normalized(team.short_name);
export const isPlayed=f=>f?.status==='finished'&&Number.isInteger(f.home_score)&&Number.isInteger(f.away_score);
export function resultSplit(fixtures,team){
 const result={played:0,wins:0,draws:0,losses:0,gf:0,ga:0,cleanSheets:0,home:{played:0,wins:0,draws:0,losses:0,gf:0,ga:0},away:{played:0,wins:0,draws:0,losses:0,gf:0,ga:0}};
 for(const f of fixtures){
  if(!isPlayed(f))continue;
  const atHome=isTeam(f.home_team,team),atAway=isTeam(f.away_team,team);
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
export function verifiedEvents(events){
 return (events||[]).filter(e=>['official','community_confirmed'].includes(e.validation_status));
}
export function eventCoverage(fixtures,matches,events,team){
 const map=new Map(matches.map(m=>[m.id,m]));
 const eventsByMatch=new Map();
 for(const event of verifiedEvents(events)){
  const list=eventsByMatch.get(event.match_id)||[];list.push(event);eventsByMatch.set(event.match_id,list);
 }
 let complete=0,possible=0,unverified=0,withoutMinutes=0,comebacks=0,concededComebacks=0,comebackWins=0;
 const location={equal:0,ahead:0,behind:0},conceded={equal:0,ahead:0,behind:0};
 for(const f of fixtures){
  if(!isPlayed(f)||(!isTeam(f.home_team,team)&&!isTeam(f.away_team,team)))continue;
  const m=matches.find(x=>x.fixture_id===f.id&&map.get(x.id)===x);
  if(!m)continue;
  possible++;
  const rows=(eventsByMatch.get(m.id)||[]).filter(e=>['goal','penalty_scored'].includes(e.event_type)&&!['own_goal','penalty_missed'].includes(e.payload?.goal_type));
  const expected=f.home_score+f.away_score;
  if(rows.length!==expected){unverified++;continue}
  if(rows.some(e=>!Number.isInteger(e.minute))){withoutMinutes++;continue}
  rows.sort((a,b)=>a.minute-b.minute||(a.stoppage_minute||0)-(b.stoppage_minute||0)||String(a.created_at).localeCompare(String(b.created_at)));
  let teamGoals=0,oppGoals=0,wasBehind=false,wasAhead=false,positive=false,negative=false;
  for(const e of rows){
   if(!['team','opponent'].includes(e.team_side)){unverified++;continue}
   const before=teamGoals-oppGoals,side=e.team_side==='team'?'location':'conceded';
   const bucket=before>0?'ahead':before<0?'behind':'equal';
   (side==='location'?location:conceded)[bucket]++;
   if(before<0)wasBehind=true;if(before>0)wasAhead=true;
   if(e.team_side==='team')teamGoals++;else oppGoals++;
   const after=teamGoals-oppGoals;
   if(wasBehind&&after>=0)positive=true;
   if(wasAhead&&after<=0)negative=true;
  }
  const officialFor=isTeam(f.home_team,team)?f.home_score:f.away_score;
  const officialAgainst=isTeam(f.home_team,team)?f.away_score:f.home_score;
  if(teamGoals!==officialFor||oppGoals!==officialAgainst){unverified++;continue}
  complete++;if(positive)comebacks++;if(negative)concededComebacks++;
  if(positive&&teamGoals>oppGoals)comebackWins++;
 }
 return {possible,complete,unverified,withoutMinutes,goalSituations:location,concededSituations:conceded,comebacks,concededComebacks,comebackWins};
}
