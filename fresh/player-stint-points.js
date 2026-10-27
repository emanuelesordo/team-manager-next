import {matchPlayerIntervals,matchElapsedMinute,matchTiming,confirmedMatchEvent} from './player-participation.js';
const point=(a,b)=>a>b?3:a===b?1:0;
const counted=e=>['goal','penalty_scored','own_goal'].includes(e.event_type)&&e.payload?.count_score!==false;
const side=(e,m)=>{let own=e.team_side==='team'||(e.team_side==='home'&&m.home_away==='home')||(e.team_side==='away'&&m.home_away==='away');if(e.event_type==='own_goal')own=!own;return own?'for':'against'};
/** Only fully timed, fully reconciled match timelines can establish score at entry and exit. */
export function playerStintPoints(matches=[],matchPlayers=[],events=[],fixtures=[],competitions=[]){
 const output=new Map(),fixturesById=new Map(fixtures.map(f=>[String(f.id),f]));
 const conf=new Map(competitions.map(c=>[String(c.id),c]));
 for(const m of matches.filter(m=>m.status==='finished'&&!m.is_test)){
  const fixture=fixturesById.get(String(m.fixture_id));if(!fixture||fixture.status!=='finished')continue;
  const players=matchPlayers.filter(p=>String(p.match_id)===String(m.id));
  const all=events.filter(e=>String(e.match_id)===String(m.id)&&confirmedMatchEvent(e));
  const competition=conf.get(String(m.competition_id))||conf.get(String(fixture.competition_id))||{};
  const timing=matchTiming(m,competition,all);
  const goals=all.filter(counted).map(e=>({event:e,time:matchElapsedMinute(e,competition,timing)}));
  const ownAtHome=m.home_away==='home';
  const expectedFor=Number(ownAtHome?fixture.home_score:fixture.away_score);
  const expectedAgainst=Number(ownAtHome?fixture.away_score:fixture.home_score);
  if(!Number.isInteger(expectedFor)||!Number.isInteger(expectedAgainst)||goals.length!==expectedFor+expectedAgainst||
    goals.some(g=>g.time===null)||goals.filter(g=>side(g.event,m)==='for').length!==expectedFor)continue;
  const intervals=matchPlayerIntervals(m,players,all,competition);
  goals.sort((a,b)=>a.time-b.time);
  // A goal coincident with a substitution cannot be unambiguously placed on either side of entry.
  const scoreAt=t=>goals.filter(g=>g.time<t).reduce((v,g)=>{v[side(g.event,m)]++;return v},{for:0,against:0});
  for(const p of players){
   const state=intervals.players.get(String(p.player_id));
   if(!state?.valid||!state.intervals.length)continue;
   let gf=0,ga=0,delta=0,safe=true;
   for(const [start,end] of state.intervals){
    if(goals.some(g=>g.time===start&&start!==0||g.time===end&&end!==timing.duration)){safe=false;break}
    const before=scoreAt(start),after=scoreAt(end);
    gf+=after.for-before.for;ga+=after.against-before.against;
    delta+=point(after.for,after.against)-point(before.for,before.against);
   }
   if(!safe)continue;
   const id=String(p.player_id),prior=output.get(id)||{stint_games:0,stint_gf:0,stint_ga:0,stint_points:0,stint_points_delta:0};
   prior.stint_games++;prior.stint_gf+=gf;prior.stint_ga+=ga;prior.stint_points+=point(gf,ga);prior.stint_points_delta+=delta;output.set(id,prior);
  }
 }
 return output;
}
