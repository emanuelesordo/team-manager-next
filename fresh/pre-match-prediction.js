import {simulateScoreTimeline} from './prediction-timeline.js';
import {cumulativeEventMinute} from './match-minutes.js';
import {matchTiming,matchElapsedMinute,confirmedMatchEvent} from './player-participation.js?v=20261014periodpriority1';
import {analyseGoalTimeline,mergeGameStateAnalyses} from './game-state.js';
import {buildTeamProfile,profileHighlights} from './team-profile.js';
import {analyseResults} from './result-intelligence.js';

const clamp=(x,low=0,hi=1)=>Math.max(low,Math.min(hi,x));
const key=v=>String(v??'');
const identity=(teamId,opponentId)=>teamId?'team:'+teamId:opponentId?'opponent:'+opponentId:null;
const homeId=f=>identity(f?.home_team_id,f?.home_opponent_id);
const awayId=f=>identity(f?.away_team_id,f?.away_opponent_id);
const standingId=s=>identity(s?.team_id,s?.opponent_id);
const isPlayed=f=>f?.status==='finished'&&Number.isInteger(f.home_score)&&Number.isInteger(f.away_score);
const goalTypes=new Set(['goal','own_goal','penalty_goal','penalty_scored']);
const numericalTypes=new Set(['red_card','second_yellow','blue_card','blue_return','temporary_return','return_from_blue']);

function scoreFor(f,club){
 if(homeId(f)===club)return [Number(f.home_score),Number(f.away_score)];
 if(awayId(f)===club)return [Number(f.away_score),Number(f.home_score)];
 return null;
}
function points(gf,ga,config){
 return gf>ga?Number(config?.win_points??3):gf<ga?Number(config?.loss_points??0):Number(config?.draw_points??1);
}
const maxWinPoints=config=>Math.max(1,Number(config?.win_points??3));

function historicalWeight(gamesPlayed,totalGames){
 const played=Math.max(0,Number(gamesPlayed)||0),total=Math.max(played,Number(totalGames)||0);
 if(total<=0)return played>0?0:1;
 if(played<=0)return 1;
 if(played>=total)return 0;
 const remaining=total-played;
 return clamp(remaining/(remaining+2.5*played));
}
function historicalPrior(club,history=[]){
 const rows=history.filter(r=>identity(r.team_id,r.opponent_id)===club)
  .sort((a,b)=>Number(b.season_start_year)-Number(a.season_start_year)).slice(0,5);
 if(!rows.length)return {score:.5,seasons:0,tierScore:.5};
 let sum=0,weightsTotal=0,tierSum=0;
 const tierValue=tier=>{
  const t=Math.max(1,Number(tier)||3);
  if(t===1)return 1;
  if(t===2)return .68;
  if(t===3)return .36;
  return clamp(1-(t-1)*.32,.12,1);
 };
 const recency=[1,.72,.52,.38,.28];
 rows.forEach((r,index)=>{
  const tier=Number(r.tier_level),position=Math.max(1,Number(r.final_position)||1);
  const totalPositions=Number(r.total_positions);
  const maxPoints=Math.max(1,Number(r.max_points)||1),earned=clamp(Number(r.points||0)/maxPoints);
  const tierScore=tierValue(tier);
  const absolutePositionScore=clamp(1/(1+.18*(position-1)),.15,1);
  const relativePositionScore=Number.isInteger(totalPositions)&&totalPositions>=2?
   clamp((totalPositions-position)/(totalPositions-1),0,1):absolutePositionScore;
  const gf=Number(r.goals_for),ga=Number(r.goals_against);
  const hasGoals=Number.isFinite(gf)&&Number.isFinite(ga)&&r.goals_for!==null&&r.goals_against!==null;
  const gd=hasGoals?gf-ga:Number(r.goal_difference),hasGd=Number.isFinite(gd)&&gd!==null&&gd!=='';
  const played=Math.max(1,Number(r.matches_played)||Math.round(maxPoints/3)||1);
  const gdPerGame=hasGd?gd/played:0;
  const gdScore=hasGd?clamp(.5+gdPerGame/4):.5;
  const scoringScore=hasGoals?clamp(.5+((gf/played)-(ga/played))/4):gdScore;
  // League level is deliberately the dominant historical signal: a poor season
  // one tier higher should still rate above a middling season one tier lower.
  const seasonScore=.60*tierScore+.17*earned+.09*relativePositionScore+.07*gdScore+.07*scoringScore;
  const weight=recency[index]??.2;
  sum+=seasonScore*weight;tierSum+=tierScore*weight;weightsTotal+=weight;
 });
 return {
  score:weightsTotal?clamp(sum/weightsTotal):.5,
  tierScore:weightsTotal?clamp(tierSum/weightsTotal):.5,
  seasons:rows.length
 };
}
function recentResultScore(rows,club,config){
 const list=rows.filter(f=>homeId(f)===club||awayId(f)===club)
  .sort((a,b)=>new Date(a.kickoff_at)-new Date(b.kickoff_at)).slice(-5);
 if(!list.length)return .5;
 let value=0,weight=0;
 list.forEach((f,index)=>{
  const [gf,ga]=scoreFor(f,club),w=index+1;
  value+=w*(points(gf,ga,config)/maxWinPoints(config));weight+=w;
 });
 return weight?clamp(value/weight):.5;
}
function normalizeVenue(value){
 return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'');
}
function fixtureVenue(fixture,venues=[]){
 const wanted=normalizeVenue(fixture?.venue_name||fixture?.venue);
 if(!wanted)return null;
 return venues.find(v=>normalizeVenue(v.name)===wanted)||
  venues.find(v=>{const n=normalizeVenue(v.name);return n.length>=5&&(wanted.includes(n)||n.includes(wanted))})||null;
}
function venueTraits(v){
 if(!v)return [];
 return [v.surface_type,v.width_profile,v.length_profile].filter(Boolean);
}
function similarVenue(a,b){
 const target=venueTraits(b);if(!target.length||!a)return false;
 let comparable=0,matches=0;
 for(const field of ['surface_type','width_profile','length_profile']){
  if(!b[field])continue;
  comparable++;
  if(a[field]===b[field])matches++;
 }
 return comparable>0&&matches/comparable>=.67;
}
function resultRate(rows,club,config){
 if(!rows.length)return .5;
 let value=0;
 for(const f of rows){const s=scoreFor(f,club);if(s)value+=points(s[0],s[1],config)/maxWinPoints(config)}
 return clamp(value/rows.length);
}
function strengthRows(teams,completed,allCompetitionRows,config,history){
 const totalGames=new Map(teams.map(team=>[team,allCompetitionRows.filter(f=>homeId(f)===team||awayId(f)===team).length]));
 const raw=new Map();
 let leagueGf=0,leagueGames=0;
 completed.forEach(f=>{leagueGf+=Number(f.home_score)+Number(f.away_score);leagueGames+=2});
 const leagueGoalRate=leagueGames?leagueGf/leagueGames:1.25;
 for(const club of teams){
  const played=completed.filter(f=>homeId(f)===club||awayId(f)===club);
  let gf=0,ga=0,pts=0;
  played.forEach(f=>{const s=scoreFor(f,club);if(!s)return;gf+=s[0];ga+=s[1];pts+=points(s[0],s[1],config)});
  const n=played.length;
  const ppg=n?pts/(n*maxWinPoints(config)):.5;
  const recent=recentResultScore(played,club,config);
  const gd=n?clamp(.5+(gf-ga)/(n*5)):.5;
  const attack=n?clamp((gf/n)/(Math.max(.3,leagueGoalRate)*2),0,1):.5;
  const defense=n?1-clamp((ga/n)/(Math.max(.3,leagueGoalRate)*2),0,1):.5;
  const current=.40*ppg+.30*recent+.15*gd+.075*attack+.075*defense;
  const structural=.45*ppg+.25*gd+.15*attack+.15*defense;
  const prior=historicalPrior(club,history);
  const scheduled=Math.max(1,totalGames.get(club)||0);
  const structuralEvidence=clamp(n/Math.max(4,scheduled*.5));
  const potential=prior.seasons?
   clamp(prior.score*(1-.45*structuralEvidence)+structural*(.45*structuralEvidence)):
   clamp(.5*(1-structuralEvidence)+structural*structuralEvidence);
  const historyWeight=historicalWeight(n,totalGames.get(club));
  const historyShare=Math.min(.22,.22*historyWeight);
  const strength=clamp(current*(1-historyShare)+prior.score*historyShare);
  const shrink=n/(n+3);
  const observedAttack=leagueGoalRate*(1-shrink)+(n?gf/n:leagueGoalRate)*shrink;
  const observedDefense=leagueGoalRate*(1-shrink)+(n?ga/n:leagueGoalRate)*shrink;
  // In the opening rounds, historical level must also shape expected goal rates,
  // not only the generic strength score. This avoids flattening a clear tier/
  // performance gap into an artificial 50/50 just because current-season data is scarce.
  const historicalRateBias=prior.seasons?(prior.score-.5)*2.2*historyWeight:0;
  raw.set(club,{club,played:n,gf,ga,ppg,recent,gd,current,structural,potential,prior:prior.score,historySeasons:prior.seasons,
   historyShare,historyWeight,historyTier:prior.tierScore,strength,totalGames:totalGames.get(club)||0,
   attackRate:clamp(observedAttack*Math.exp(historicalRateBias),.25,3.8),
   defenseRate:clamp(observedDefense*Math.exp(-historicalRateBias),.25,3.8)});
 }
 return {rows:raw,leagueGoalRate};
}
function rankBucket(diff){
 return diff>.075?'higher':diff<-.075?'lower':'similar';
}
function matchupBehavior(club,targetOpponent,completed,strengths,config){
 const own=strengths.get(club);if(!own)return {bucket:'similar',sample:0,rate:.5,delta:0};
 const target=strengths.get(targetOpponent);
 const bucket=rankBucket((target?.potential??.5)-own.potential);
 const rows=completed.filter(f=>homeId(f)===club||awayId(f)===club).filter(f=>{
  const opp=homeId(f)===club?awayId(f):homeId(f);
  const other=strengths.get(opp);return rankBucket((other?.potential??.5)-own.potential)===bucket;
 });
 const rate=resultRate(rows,club,config);
 const delta=rows.length?clamp(rate-own.ppg,-.35,.35):0;
 return {bucket,sample:rows.length,rate,delta};
}
function venueBehavior(club,targetVenue,completed,venues,config,overall){
 if(!targetVenue||!venueTraits(targetVenue).length)return {sample:0,rate:.5,delta:0,profile:false};
 const rows=completed.filter(f=>(homeId(f)===club||awayId(f)===club)&&similarVenue(fixtureVenue(f,venues),targetVenue));
 const rate=resultRate(rows,club,config);
 return {sample:rows.length,rate,delta:rows.length?clamp(rate-overall,-.3,.3):0,profile:true};
}
function eventSide(event){
 if(event?.team_side==='team'||event?.team_side==='opponent')return event.team_side;
 return null;
}
function goalSide(event){
 let side=eventSide(event);
 if(event?.event_type==='own_goal')side=side==='team'?'opponent':side==='opponent'?'team':side;
 return side;
}
function completeGoalTimeline(fixture,events,competition){
 const goals=events.filter(e=>goalTypes.has(e.event_type)&&e.payload?.count_score!==false&&['official','community_confirmed'].includes(e.validation_status));
 if(goals.length!==Number(fixture.home_score)+Number(fixture.away_score))return null;
 if(goals.some(e=>!Number.isInteger(e.minute)))return null;
 return goals.slice().sort((a,b)=>(cumulativeEventMinute(a,competition)??999)-(cumulativeEventMinute(b,competition)??999)||
  Number(a.stoppage_minute||0)-Number(b.stoppage_minute||0)||String(a.created_at||'').localeCompare(String(b.created_at||'')));
}
function managementBehavior(club,primaryTeam,completed,matches,events,competitions){
 if(club!=='team:'+primaryTeam?.id)return null;
 const matchByFixture=new Map((matches||[]).filter(m=>m.fixture_id).map(m=>[key(m.fixture_id),m]));
 const byMatch=new Map();
 (events||[]).forEach(e=>{const list=byMatch.get(key(e.match_id))||[];list.push(e);byMatch.set(key(e.match_id),list)});
 let led=0,ledValue=0,trailed=0,trailValue=0,complete=0;
 for(const f of completed.filter(x=>homeId(x)===club||awayId(x)===club)){
  const m=matchByFixture.get(key(f.id));if(!m)continue;
  const comp=(competitions||[]).find(c=>key(c.id)===key(f.competition_id));
  const timeline=completeGoalTimeline(f,byMatch.get(key(m.id))||[],comp);if(!timeline)continue;
  let ours=0,theirs=0,wasAhead=false,wasBehind=false;
  for(const e of timeline){
   const side=goalSide(e);if(side==='team')ours++;else if(side==='opponent')theirs++;
   if(ours>theirs)wasAhead=true;if(ours<theirs)wasBehind=true;
  }
  const s=scoreFor(f,club);if(!s)continue;complete++;
  const finalValue=s[0]>s[1]?1:(s[0]===s[1] ? .5 : 0);
  if(wasAhead){led++;ledValue+=finalValue}
  if(wasBehind){trailed++;trailValue+=finalValue}
 }
 const components=[];
 if(led>=2)components.push(ledValue/led);
 if(trailed>=2)components.push(trailValue/trailed);
 if(!components.length)return {sample:complete,score:.5,delta:0,led,trailed,insufficient:true};
 const score=components.reduce((a,b)=>a+b,0)/components.length;
 return {sample:complete,score,delta:clamp(score-.5,-.3,.3),led,trailed,insufficient:false};
}
function numericalBehavior(club,primaryTeam,completed,matches,events,competitions){
 if(club!=='team:'+primaryTeam?.id)return null;
 const matchByFixture=new Map((matches||[]).filter(m=>m.fixture_id).map(m=>[key(m.fixture_id),m]));
 const byMatch=new Map();
 (events||[]).forEach(e=>{const list=byMatch.get(key(e.match_id))||[];list.push(e);byMatch.set(key(e.match_id),list)});
 let superiorMinutes=0,inferiorMinutes=0,superiorGd=0,inferiorGd=0;
 for(const f of completed.filter(x=>homeId(x)===club||awayId(x)===club)){
  const m=matchByFixture.get(key(f.id));if(!m)continue;
  const comp=(competitions||[]).find(c=>key(c.id)===key(f.competition_id))||{};
  const duration=Math.max(1,Number(comp.periods||2))*Math.max(1,Number(comp.minutes_per_period||40));
  const rows=(byMatch.get(key(m.id))||[]).filter(e=>['official','community_confirmed'].includes(e.validation_status)&&
   (goalTypes.has(e.event_type)||numericalTypes.has(e.event_type))).map(e=>({e,minute:cumulativeEventMinute(e,comp)}))
   .filter(x=>Number.isFinite(x.minute)).sort((a,b)=>a.minute-b.minute||String(a.e.created_at||'').localeCompare(String(b.e.created_at||'')));
  let balance=0,cursor=0;
  const addTime=minute=>{
   const to=Math.max(cursor,Math.min(duration,Number(minute)||0)),delta=Math.max(0,to-cursor);
   if(balance>0)superiorMinutes+=delta;else if(balance<0)inferiorMinutes+=delta;cursor=to;
  };
  for(const row of rows){
   addTime(row.minute);
   const e=row.e,side=eventSide(e);
   if(goalTypes.has(e.event_type)){
    const scorer=goalSide(e);
    if(balance>0)superiorGd+=scorer==='team'?1:scorer==='opponent'?-1:0;
    if(balance<0)inferiorGd+=scorer==='team'?1:scorer==='opponent'?-1:0;
    continue;
   }
   if(e.event_type==='red_card'||e.event_type==='second_yellow'||e.event_type==='blue_card'){
    if(side==='team')balance--;if(side==='opponent')balance++;
   }else if(['blue_return','temporary_return','return_from_blue'].includes(e.event_type)){
    if(side==='team')balance++;if(side==='opponent')balance--;
   }
  }
  addTime(duration);
 }
 const exposure=superiorMinutes+inferiorMinutes;
 if(exposure<20)return {exposure,superiorMinutes,inferiorMinutes,score:.5,delta:0,insufficient:true};
 const supRate=superiorMinutes?superiorGd/(superiorMinutes/40):0;
 const infRate=inferiorMinutes?inferiorGd/(inferiorMinutes/40):0;
 const score=clamp(.5+.10*clamp(supRate/2,-1,1)+.10*clamp(infRate/2,-1,1));
 return {exposure,superiorMinutes,inferiorMinutes,score,delta:clamp(score-.5,-.2,.2),insufficient:false};
}

function eventFixture(event,matchesById,fixturesById){
 if(event?.fixture_id&&fixturesById.has(key(event.fixture_id)))return fixturesById.get(key(event.fixture_id));
 const match=matchesById.get(key(event?.match_id));
 return match?.fixture_id?fixturesById.get(key(match.fixture_id))||null:null;
}
function eventClub(event,fixture,primaryTeam,forGoal=false){
 if(!event||!fixture)return null;
 let side=event.team_side||event.side;
 if(forGoal&&event.event_type==='own_goal'){
  if(side==='home')side='away';else if(side==='away')side='home';
  else if(side==='team')side='opponent';else if(side==='opponent')side='team';
 }
 if(side==='home')return homeId(fixture);
 if(side==='away')return awayId(fixture);
 if(side==='team'||side==='opponent'){
  const primary=primaryTeam?.id?'team:'+primaryTeam.id:null;
  if(!primary)return null;
  const opponent=homeId(fixture)===primary?awayId(fixture):awayId(fixture)===primary?homeId(fixture):null;
  return side==='team'?primary:opponent;
 }
 return null;
}
function comparisonMetrics(club,completed,config){
 const rows=completed.filter(f=>homeId(f)===club||awayId(f)===club);
 let gf=0,ga=0,pts=0;
 for(const f of rows){const s=scoreFor(f,club);if(!s)continue;gf+=s[0];ga+=s[1];pts+=points(s[0],s[1],config)}
 const played=rows.length;
 const recent=rows.slice().sort((a,b)=>Date.parse(a.kickoff_at)-Date.parse(b.kickoff_at)).slice(-5);
 let recentPts=0;for(const f of recent){const s=scoreFor(f,club);if(s)recentPts+=points(s[0],s[1],config)}
 return {played,ppg:played?pts/played:0,gfPerGame:played?gf/played:0,gaPerGame:played?ga/played:0,gdPerGame:played?(gf-ga)/played:0,
  recentPpg:recent.length?recentPts/recent.length:0};
}
function situationalMetrics(club,completed,matches,events,competitions,primaryTeam){
 const fixturesById=new Map(completed.map(f=>[key(f.id),f]));
 const matchesById=new Map((matches||[]).map(m=>[key(m.id),m]));
 const byFixture=new Map();
 for(const e of events||[]){
  if(!confirmedMatchEvent(e))continue;
  const f=eventFixture(e,matchesById,fixturesById);if(!f)continue;
  const list=byFixture.get(key(f.id))||[];list.push(e);byFixture.set(key(f.id),list);
 }
 let timelineSample=0,trailed=0,recovered=0,comebackWins=0,led=0,heldLead=0,lostLead=0,leadPointsLost=0,leadPointsLostGames=0;
 let scoredFirst=0,scoredFirstWins=0,concededFirst=0,concededFirstWins=0,concededFirstRecoveredPoints=0;
 let opponentReds=0,ownReds=0,cardSample=0;
 const timing=new Map(),gameStates=[];
 for(const f of completed.filter(x=>homeId(x)===club||awayId(x)===club)){
  const all=byFixture.get(key(f.id))||[];
  cardSample++;
  for(const e of all){
   if(!['red_card','second_yellow'].includes(e.event_type))continue;
   const receiver=eventClub(e,f,primaryTeam,false);
   if(receiver===club)ownReds++;else if(receiver)opponentReds++;
  }
  const goals=all.filter(e=>goalTypes.has(e.event_type)&&e.payload?.count_score!==false);
  const comp=(competitions||[]).find(x=>key(x.id)===key(f.competition_id));
  const operational=(matches||[]).find(m=>key(m.fixture_id)===key(f.id))||f;
  const verifiedTiming=matchTiming(operational,comp,all);
  const minuteOf=e=>matchElapsedMinute(e,comp,verifiedTiming);
  const completeTimeline=goals.length===Number(f.home_score)+Number(f.away_score)&&goals.length>0&&goals.every(e=>minuteOf(e)!==null);
  if(!completeTimeline)continue;

  goals.sort((a,b)=>(minuteOf(a)??Infinity)-(minuteOf(b)??Infinity)||
   String(a.created_at||'').localeCompare(String(b.created_at||'')));
  let ours=0,theirs=0,wasBehind=false,wasAhead=false,reachedEqualAfterBehind=false,reachedEqualAfterAhead=false;
  const periodMinutes=Math.max(1,Number(comp?.minutes_per_period)||40),matchMinutes=Math.max(1,Number(comp?.periods)||2)*periodMinutes;
  const windowSize=Math.max(1,periodMinutes/2);
  for(const e of goals){
   const scorer=eventClub(e,f,primaryTeam,true);if(!scorer)continue;
   const minute=Math.max(1,Number(cumulativeEventMinute(e,comp)||1));
   const rawIndex=Math.floor((Math.min(minute,matchMinutes)-1)/windowSize);
   const windowIndex=Math.max(0,Math.min(3,rawIndex));
   const start=Math.floor(windowIndex*windowSize)+1,end=Math.round(Math.min(matchMinutes,(windowIndex+1)*windowSize));
   const label=start+"′–"+end+"′",bucket=timing.get(label)||{label,start,end,for:0,against:0};
   if(scorer===club){ours++;bucket.for++}else{theirs++;bucket.against++}
   timing.set(label,bucket);
   if(ours<theirs)wasBehind=true;if(ours>theirs)wasAhead=true;
   if(wasBehind&&ours>=theirs)reachedEqualAfterBehind=true;
   if(wasAhead&&ours<=theirs)reachedEqualAfterAhead=true;
  }
  gameStates.push(analyseGoalTimeline(goals,{
   sideOf:e=>eventClub(e,f,primaryTeam,true)===club?'team':'opponent',
   minuteOf,
   duration:verifiedTiming.duration,responseWindow:10
  }));
  timelineSample++;
  const s=scoreFor(f,club);if(!s)continue;
  const firstGoal=goals[0],firstScorer=firstGoal?eventClub(firstGoal,f,primaryTeam,true):null;
  if(firstScorer===club){scoredFirst++;if(s[0]>s[1])scoredFirstWins++}
  else if(firstScorer){concededFirst++;if(s[0]>s[1])concededFirstWins++;if(s[0]>=s[1])concededFirstRecoveredPoints++}
  if(wasBehind){trailed++;if(reachedEqualAfterBehind)recovered++;if(s[0]>s[1])comebackWins++}
  if(wasAhead){led++;if(s[0]>s[1])heldLead++;if(reachedEqualAfterAhead)lostLead++;if(s[0]<=s[1]){leadPointsLost+=s[0]===s[1]?2:3;leadPointsLostGames++}}
 }
 const goalWindows=[...timing.values()].sort((a,b)=>a.start-b.start);
 const totalFor=goalWindows.reduce((s,x)=>s+x.for,0),totalAgainst=goalWindows.reduce((s,x)=>s+x.against,0);
 const strongestFor=goalWindows.slice().sort((a,b)=>b.for-a.for||a.start-b.start)[0]||null;
 const weakestAgainst=goalWindows.slice().sort((a,b)=>b.against-a.against||a.start-b.start)[0]||null;
 const gameState=mergeGameStateAnalyses(gameStates);
 return {timelineSample,trailed,recovered,comebackWins,led,heldLead,lostLead,leadPointsLost,leadPointsLostGames,cardSample,opponentReds,ownReds,
  scoredFirst,scoredFirstWins,concededFirst,concededFirstWins,concededFirstRecoveredPoints,
  scoredFirstWinRate:scoredFirst?scoredFirstWins/scoredFirst:null,
  concededFirstWinRate:concededFirst?concededFirstWins/concededFirst:null,
  recoveryRate:trailed?recovered/trailed:null,leadHoldRate:led?heldLead/led:null,
  opponentRedRate:cardSample?opponentReds/cardSample:null,ownRedRate:cardSample?ownReds/cardSample:null,
  gameState,goalWindows,totalTimedGoalsFor:totalFor,totalTimedGoalsAgainst:totalAgainst,strongestFor,weakestAgainst};
}
function attentionPoints(homeName,awayName,homeBase,awayBase,homeSitu,awaySitu){
 const out=[];
 const push=(club,label,value,detail,tone='watch')=>out.push({club,label,value,detail,tone});
 const inspect=(name,base,situ)=>{
  if(base.played>=2&&base.recentPpg-base.ppg>=.5)push(name,'Forma in crescita','↑',base.recentPpg.toFixed(2)+' punti/gara nelle ultime contro '+base.ppg.toFixed(2)+' complessivi','strength');
  if(base.played>=2&&base.ppg-base.recentPpg>=.5)push(name,'Forma in calo','↓',base.recentPpg.toFixed(2)+' punti/gara recenti contro '+base.ppg.toFixed(2)+' complessivi','risk');
  if(situ.scoredFirst>=2&&situ.scoredFirstWinRate>=.6)push(name,'Capitalizza il primo gol',Math.round(situ.scoredFirstWinRate*100)+'%',situ.scoredFirstWins+' vittorie in '+situ.scoredFirst+' gare in cui ha segnato per prima','strength');
  if(situ.concededFirst>=2&&situ.concededFirstWinRate<=.25)push(name,'Soffre il primo svantaggio',Math.round((1-situ.concededFirstWinRate)*100)+'%',situ.concededFirst+' gare partendo sotto, solo '+situ.concededFirstWins+' vinte','risk');
  if(situ.trailed>=2&&situ.recoveryRate>=.5)push(name,'Rimonta spesso',Math.round(situ.recoveryRate*100)+'%',situ.recovered+' recuperi dopo essere andata sotto in '+situ.trailed+' casi','strength');
  if(situ.led>=2&&situ.leadHoldRate>=.75)push(name,'Protegge bene il vantaggio',Math.round(situ.leadHoldRate*100)+'%',situ.heldLead+' vittorie dopo essere passata avanti in '+situ.led+' gare','strength');
  if(situ.led>=2&&situ.lostLead/situ.led>=.5)push(name,'Vantaggio vulnerabile',Math.round(100*situ.lostLead/situ.led)+'%',situ.lostLead+' volte raggiunta dopo essere passata avanti','risk');
  if(situ.cardSample>=2&&situ.opponentRedRate>=.25)push(name,'Fa espellere avversari',situ.opponentReds,situ.opponentReds+' espulsioni avversarie in '+situ.cardSample+' gare con eventi disponibili','watch');
  if(situ.cardSample>=2&&situ.ownRedRate>=.25)push(name,'Rischio disciplina',situ.ownReds,situ.ownReds+' espulsioni proprie in '+situ.cardSample+' gare con eventi disponibili','risk');
  const gs=situ.gameState||{},teamRoles=gs.roles?.team||{},oppRoles=gs.roles?.opponent||{};
  if((teamRoles.equalizer||0)>=2)push(name,'Reazione al vantaggio avversario',teamRoles.equalizer,(teamRoles.equalizer||0)+' pareggi trovati durante la timeline dopo uno svantaggio','strength');
  if((teamRoles.deficit_reduction||0)>=2)push(name,'Riapre gare compromesse',teamRoles.deficit_reduction,(teamRoles.deficit_reduction||0)+' gol di accorciamento segnati restando ancora sotto','watch');
  if((oppRoles.equalizer||0)>=2)push(name,'Si fa raggiungere',oppRoles.equalizer,(oppRoles.equalizer||0)+' gol del pareggio concessi mentre era avanti','risk');
  if(situ.leadPointsLost>0)push(name,'Punti persi dopo il vantaggio',situ.leadPointsLost,situ.leadPointsLost+' punti non conquistati in '+situ.leadPointsLostGames+' gare concluse senza vittoria dopo essere stata avanti','risk');
  if((gs.quickResponsesFor||0)>=2)push(name,'Risposta rapida',gs.quickResponsesFor,(gs.quickResponsesFor||0)+' risposte entro 10 minuti da una rete avversaria','strength');
  if((gs.quickResponsesAgainst||0)>=2)push(name,'Vulnerabile dopo il gol',gs.quickResponsesAgainst,(gs.quickResponsesAgainst||0)+' reti subite entro 10 minuti da una propria marcatura','risk');
  if(base.played>=2&&base.gfPerGame>=base.gaPerGame+.75)push(name,'Produzione offensiva','+'+(base.gfPerGame-base.gaPerGame).toFixed(1),base.gfPerGame.toFixed(1)+' gol fatti/gara contro '+base.gaPerGame.toFixed(1)+' subiti','strength');
 };
 inspect(homeName,homeBase,homeSitu);inspect(awayName,awayBase,awaySitu);
 return out.slice(0,8);
}
function fixtureOpponentRelevance(club,targetOpponent,completed,strengths){
 const target=strengths.get(targetOpponent)?.potential??.5;
 const out={};
 for(const f of completed.filter(x=>homeId(x)===club||awayId(x)===club)){
  const opp=homeId(f)===club?awayId(f):homeId(f);
  const potential=strengths.get(opp)?.potential??.5;
  out[f.id]=clamp(Math.exp(-Math.abs(potential-target)*6),.35,1);
 }
 return out;
}
function stableChoice(seed,items=[]){
 if(!items.length)return '';
 let h=0;for(const ch of String(seed||''))h=(h*31+ch.charCodeAt(0))>>>0;
 return items[h%items.length];
}
function matchNarrative({fixture,probability,expectedGoals,home,away,homeComparison,awayComparison,homeSituational,awaySituational,homeIntelligence,awayIntelligence,venue,attention=[]}){
 const score=probability?.topScorelines?.[0]||probability?.mostLikely||{home:0,away:0,probability:0};
 const total=Number(expectedGoals.home||0)+Number(expectedGoals.away||0);
 const gap=Number(expectedGoals.home||0)-Number(expectedGoals.away||0);
 const homeForm=Number(homeComparison?.recentPpg||0)-Number(homeComparison?.ppg||0);
 const awayForm=Number(awayComparison?.recentPpg||0)-Number(awayComparison?.ppg||0);
 const rankGap=Math.abs(Number(home?.potentialRank||0)-Number(away?.potentialRank||0));
 const favorite=probability.home>probability.away?fixture.home_team:probability.away>probability.home?fixture.away_team:null;
 const underdog=favorite===fixture.home_team?fixture.away_team:favorite===fixture.away_team?fixture.home_team:null;
 const favProb=Math.max(Number(probability.home||0),Number(probability.away||0));
 const seed=fixture.id||fixture.home_team+'-'+fixture.away_team;
 const candidates=[];
 const add=(priority,text,key)=>{if(text)candidates.push({priority,text,key})};

 if(favorite&&favProb>=.62){
  add(100,stableChoice(seed+'fav',[
   favorite+' parte con un vantaggio strutturale piuttosto netto: il modello assegna '+Math.round(favProb*100)+'% all’esito favorevole e lo score singolo più probabile è '+score.home+'–'+score.away+'.',
   'La partita pende verso '+favorite+': il '+Math.round(favProb*100)+'% sull’esito e il '+score.home+'–'+score.away+' come score più probabile descrivono un margine che non è solo di forma recente.',
   favorite+' è la squadra da battere in questo incrocio: probabilità di esito '+Math.round(favProb*100)+'%, con '+score.home+'–'+score.away+' come risultato esatto più frequente nella distribuzione.'
  ]),'fav');
 }else if(favorite&&favProb>=.52){
  add(90,stableChoice(seed+'edge',[
   favorite+' ha un vantaggio, ma non abbastanza ampio da rendere la gara unidirezionale: '+score.home+'–'+score.away+' resta lo score più probabile.',
   'Il modello inclina verso '+favorite+' senza creare uno strappo netto: il risultato esatto più probabile è '+score.home+'–'+score.away+'.',
   'C’è un margine per '+favorite+', ma la distribuzione resta compatta: '+score.home+'–'+score.away+' è il singolo score con più massa.'
  ]),'edge');
 }else{
  add(85,stableChoice(seed+'bal',[
   'Il confronto è molto equilibrato: '+score.home+'–'+score.away+' emerge come score più probabile, ma nessun esito prende davvero il largo.',
   'Le due squadre arrivano su valori vicini: il modello concentra la probabilità attorno a '+score.home+'–'+score.away+' senza un favorito netto.',
   'È uno degli incroci più bilanciati del turno: '+score.home+'–'+score.away+' guida gli score esatti, con margini ridotti tra 1, X e 2.'
  ]),'balance');
 }

 if(rankGap>=3&&favorite){
  add(96,'Il rango atteso crea un divario di '+rankGap+' posizioni a favore di '+favorite+'; nelle prime giornate questo segnale pesa più della classifica corrente, che è ancora poco stabile.','rank');
 }else if(rankGap===2&&favorite){
  add(78,'Il potenziale atteso separa le squadre di due fasce: è un vantaggio reale per '+favorite+', ma non abbastanza forte da annullare forma e contesto della gara.','rank');
 }

 const formDiff=homeForm-awayForm;
 if(Math.abs(formDiff)>=.65){
  const better=formDiff>0?fixture.home_team:fixture.away_team,worse=formDiff>0?fixture.away_team:fixture.home_team;
  add(88,'La dinamica recente è uno dei segnali più forti: '+better+' sta rendendo sopra la propria media, mentre '+worse+' arriva con una traiettoria sensibilmente peggiore.','form');
 }else if(Math.abs(formDiff)>=.3){
  const better=formDiff>0?fixture.home_team:fixture.away_team;
  add(62,'La forma recente dà un piccolo vantaggio a '+better+', ma il campione non è abbastanza forte da dominare il pronostico.','form');
 }

 const hRes=homeIntelligence,aRes=awayIntelligence;
 if(hRes?.played>=4&&aRes?.played>=4&&hRes.bothScore?.rate>=.7&&aRes.bothScore?.rate>=.7)
  add(81,'Entrambe le squadre hanno visto segnare tutte e due le formazioni in almeno il 70% delle proprie gare concluse: un segnale descrittivo di partite con occasioni per entrambe, non una garanzia di gol.','bothscore');
 if(hRes?.played>=4&&aRes?.played>=4&&hRes.closeAtFinal?.rate>=.7&&aRes.closeAtFinal?.rate>=.7)
  add(80,'I risultati finali di entrambe sono stati spesso decisi da non più di un gol: il profilo storico suggerisce equilibrio nello scarto, indipendentemente da chi parta favorita.','tightness');
 const hAdjusted=hRes?.form?.opponentAdjusted,aAdjusted=aRes?.form?.opponentAdjusted;
 if(hRes?.form?.adjustedSample>=3&&aRes?.form?.adjustedSample>=3&&
    hAdjusted!=null&&aAdjusted!=null&&Math.abs(hAdjusted-aAdjusted)>=.25){
  const name=hAdjusted>aAdjusted?fixture.home_team:fixture.away_team;
  add(88,'Anche correggendo gli ultimi risultati per il livello delle avversarie affrontate, '+name+' mantiene la forma recente più favorevole.','strength-adjusted-form');
 }
 if(total>=3.35){
  if(Math.abs(gap)>=.85&&favorite)
   add(82,'Il volume di gol atteso è alto soprattutto perché '+favorite+' produce molto più dell’avversaria: il rischio principale è che la gara si apra dopo il primo vantaggio, non necessariamente che sia equilibrata.','goals');
  else
   add(72,stableChoice(seed+'highgoals',[
    'Gli xG complessivi sono elevati e distribuiti su entrambe le squadre: sono plausibili più fasi offensive e un punteggio che si muove più di una volta.',
    'Il modello concentra parecchia massa su score con almeno tre reti complessive; qui il tema è il volume offensivo, più che un generico equilibrio.',
    'La somma degli xG è alta: una gara con più episodi da gol è sensibilmente più probabile rispetto a un match bloccato.'
   ]),'goals');
 }else if(total<=1.75){
  add(76,stableChoice(seed+'lowgoals',[
   'Il modello vede poco margine offensivo complessivo: un gol iniziale avrebbe un peso molto superiore alla media.',
   'Gli xG bassi suggeriscono una partita da pochi episodi, dove il pareggio resta vivo a lungo se nessuno trova presto il vantaggio.',
   'La distribuzione premia score corti: è più probabile una gara compressa che una sequenza di ribaltamenti.'
  ]),'goals');
 }else if(Math.abs(gap)>=.75&&favorite){
  add(70,'Gli xG non indicano necessariamente una gara ricca, ma sono sbilanciati verso '+favorite+': il vantaggio nasce dalla qualità attesa delle occasioni più che dal numero totale di gol.','goals');
 }

 const roleRate=(situ,side,role)=>{
  const gs=situ?.gameState,count=gs?.roles?.[side]?.[role]||0;
  return gs?.matches?count/gs.matches:0;
 };
 const homeEqualize=roleRate(homeSituational,'team','equalizer'),awayLoseLead=roleRate(awaySituational,'opponent','equalizer');
 const awayEqualize=roleRate(awaySituational,'team','equalizer'),homeLoseLead=roleRate(homeSituational,'opponent','equalizer');
 if(homeEqualize>=.35&&awayLoseLead>=.35)
  add(94,fixture.home_team+' mostra capacità di pareggiare quando va sotto, mentre '+fixture.away_team+' concede spesso il pareggio dopo essere passata avanti: è un incrocio favorevole a una riapertura della gara.','state-matchup-home');
 if(awayEqualize>=.35&&homeLoseLead>=.35)
  add(94,fixture.away_team+' mostra capacità di pareggiare quando va sotto, mentre '+fixture.home_team+' concede spesso il pareggio dopo essere passata avanti: il vantaggio iniziale potrebbe non essere stabile.','state-matchup-away');
 const homeQuick=homeSituational?.gameState?.quickResponsesFor||0,awayQuickAgainst=awaySituational?.gameState?.quickResponsesAgainst||0;
 const awayQuick=awaySituational?.gameState?.quickResponsesFor||0,homeQuickAgainst=homeSituational?.gameState?.quickResponsesAgainst||0;
 if(homeQuick>=2&&awayQuickAgainst>=2)add(90,fixture.home_team+' ha già mostrato reazioni rapide dopo aver subito, mentre '+fixture.away_team+' tende a concedere poco dopo aver segnato. Attenzione ai 10 minuti successivi a un eventuale vantaggio ospite.','response-home');
 if(awayQuick>=2&&homeQuickAgainst>=2)add(90,fixture.away_team+' ha già mostrato reazioni rapide dopo aver subito, mentre '+fixture.home_team+' tende a concedere poco dopo aver segnato. Attenzione ai 10 minuti successivi a un eventuale vantaggio di casa.','response-away');
 const firstSignal=attention.find(x=>/Capitalizza il primo gol|Soffre il primo svantaggio/i.test(x.label));
 if(firstSignal)add(86,firstSignal.club+': '+firstSignal.label.toLowerCase()+'. '+firstSignal.detail+'.','firstgoal');
 const stateSignals=attention.filter(x=>/Rimonta|Vantaggio vulnerabile|Protegge bene/i.test(x.label));
 if(stateSignals.length){
  const s=stateSignals[0];
  add(84,s.club+': '+s.label.toLowerCase()+'. '+s.detail+'. Questo incide sulla lettura della gara soprattutto se il punteggio si sblocca presto.','state');
 }
 const discipline=attention.find(x=>/espellere|disciplina/i.test(x.label));
 if(discipline) add(64,discipline.club+' ha anche un segnale disciplinare rilevante: '+discipline.detail+'. È un fattore secondario, ma può amplificare un vantaggio già esistente.','discipline');

 if((home.played<=3||away.played<=3)&&(Number(home.historyShare||0)+Number(away.historyShare||0)>.1)){
  const stronger=(home.prior??.5)>(away.prior??.5)?fixture.home_team:(away.prior??.5)>(home.prior??.5)?fixture.away_team:null;
  add(80,stronger?
   'Con pochi risultati stagionali disponibili, lo storico recente continua a pesare molto e favorisce '+stronger+'; il suo peso scenderà progressivamente con l’aumentare delle gare correnti.':
   'Con pochi risultati stagionali disponibili, lo storico recente resta una parte importante del modello; il suo peso scenderà man mano che cresce il campione corrente.','history');
 }

 if(venue&&[venue.surface_type,venue.width_profile,venue.length_profile].some(Boolean)){
  add(42,'Il profilo di '+venue.name+' è usato solo come correttivo quando esistono precedenti su campi simili; non viene trasformato automaticamente in vantaggio casa.','venue');
 }

 const unique=[],seen=new Set();
 for(const item of candidates.sort((a,b)=>b.priority-a.priority)){
  if(seen.has(item.key))continue;seen.add(item.key);unique.push(item);
  if(unique.length>=4)break;
 }
 return unique.map(x=>x.text).join(' ');
}
function factorial(n){let r=1;for(let i=2;i<=n;i++)r*=i;return r}
function poissonProbability(k,lambda){return Math.exp(-lambda)*Math.pow(lambda,k)/factorial(k)}
function outcomeProbabilities(homeLambda,awayLambda){
 let home=0,draw=0,away=0,total=0;
 const scorelines=[];
 for(let h=0;h<=10;h++)for(let a=0;a<=10;a++){
  const p=poissonProbability(h,homeLambda)*poissonProbability(a,awayLambda);total+=p;
  scorelines.push({home:h,away:a,p});
  if(h>a)home+=p;else if(h<a)away+=p;else draw+=p;
 }
 if(total>0){home/=total;draw/=total;away/=total}
 const topScorelines=scorelines.sort((x,y)=>y.p-x.p).slice(0,3)
  .map(x=>({home:x.home,away:x.away,probability:x.p/Math.max(total,1e-9)}));
 return {home,draw,away,mostLikely:topScorelines[0],topScorelines};
}
function potentialRankOf(club,strengths){
 return 1+[...strengths.values()].filter(x=>x.potential>(strengths.get(club)?.potential??.5)).length;
}
function bucketLabel(bucket){return bucket==='higher'?'potenziale superiore':bucket==='lower'?'potenziale inferiore':'potenziale simile'}

export function predictionSignature({fixture,fixtures=[],history=[],venues=[],events=[]}={}){
 return JSON.stringify([
  fixture?.id,fixture?.kickoff_at,fixture?.competition_id,
  fixtures.filter(f=>f.competition_id===fixture?.competition_id).map(f=>[f.id,f.status,f.kickoff_at,homeId(f),awayId(f),f.home_score,f.away_score,f.venue_name||f.venue]).sort(),
  history.map(r=>[identity(r.team_id,r.opponent_id),r.season_start_year,r.tier_level,r.final_position,r.total_positions,r.points,r.max_points,r.matches_played,r.goals_for,r.goals_against,r.goal_difference]).sort(),
  venues.map(v=>[v.id,v.name,v.surface_type,v.width_profile,v.length_profile]).sort(),
  events.map(e=>[e.id,e.match_id,e.event_type,e.minute,e.stoppage_minute,e.team_side,e.validation_status,e.payload?.count_score]).sort()
 ]);
}

export function predictMatch({fixture,competition,fixtures=[],history=[],venues=[],matches=[],events=[],team,competitions=[],retrospective=false}={}){
 if(!fixture?.id||!competition?.id)return null;
 if(!retrospective&&['live','finished','cancelled'].includes(fixture.status))return null;
 if(retrospective&&fixture.status==='cancelled')return null;
 const kickoff=Date.parse(fixture.kickoff_at||'');
 const rows=fixtures.filter(f=>f.competition_id===competition.id&&f.id!==fixture.id&&f.status!=='cancelled');
 const completed=rows.filter(f=>isPlayed(f)&&(!Number.isFinite(kickoff)||Date.parse(f.kickoff_at||'')<kickoff));
 const competitionRows=fixtures.filter(f=>f.competition_id===competition.id&&f.status!=='cancelled');
 const teams=[...new Set(competitionRows.flatMap(f=>[homeId(f),awayId(f)]).filter(Boolean))];
 const homeClub=homeId(fixture),awayClub=awayId(fixture);
 if(!homeClub||!awayClub||!teams.includes(homeClub)||!teams.includes(awayClub))return null;

 const {rows:strengths,leagueGoalRate}=strengthRows(teams,completed,competitionRows,competition,history);
 const home=strengths.get(homeClub),away=strengths.get(awayClub);
 if(!home||!away)return null;

 const homeBehavior=matchupBehavior(homeClub,awayClub,completed,strengths,competition);
 const awayBehavior=matchupBehavior(awayClub,homeClub,completed,strengths,competition);
 const homeComparableFixtures=completed.filter(f=>homeId(f)===homeClub||awayId(f)===homeClub).filter(f=>{
  const opp=homeId(f)===homeClub?awayId(f):homeId(f),other=strengths.get(opp);
  return rankBucket((other?.potential??.5)-home.potential)===homeBehavior.bucket;
 }).map(f=>f.id);
 const awayComparableFixtures=completed.filter(f=>homeId(f)===awayClub||awayId(f)===awayClub).filter(f=>{
  const opp=homeId(f)===awayClub?awayId(f):homeId(f),other=strengths.get(opp);
  return rankBucket((other?.potential??.5)-away.potential)===awayBehavior.bucket;
 }).map(f=>f.id);
 const homeFixtureRelevance=fixtureOpponentRelevance(homeClub,awayClub,completed,strengths);
 const awayFixtureRelevance=fixtureOpponentRelevance(awayClub,homeClub,completed,strengths);
 const targetVenue=fixtureVenue(fixture,venues);
 const homeVenue=venueBehavior(homeClub,targetVenue,completed,venues,competition,home.ppg);
 const awayVenue=venueBehavior(awayClub,targetVenue,completed,venues,competition,away.ppg);
 const homeManagement=managementBehavior(homeClub,team,completed,matches,events,competitions);
 const awayManagement=managementBehavior(awayClub,team,completed,matches,events,competitions);
 const homeNumerical=numericalBehavior(homeClub,team,completed,matches,events,competitions);
 const awayNumerical=numericalBehavior(awayClub,team,completed,matches,events,competitions);
 const homeComparison=comparisonMetrics(homeClub,completed,competition),awayComparison=comparisonMetrics(awayClub,completed,competition);
 const homeSituational=situationalMetrics(homeClub,completed,matches,events,competitions,team);
 const awaySituational=situationalMetrics(awayClub,completed,matches,events,competitions,team);
 const profileNumbers=club=>{
  const rows=completed.filter(f=>homeId(f)===club||awayId(f)===club).sort((a,b)=>new Date(a.kickoff_at)-new Date(b.kickoff_at));
  const homeRows=rows.filter(f=>homeId(f)===club),awayRows=rows.filter(f=>awayId(f)===club);
  const part=list=>{
   let wins=0,draws=0,losses=0,gf=0,ga=0;
   for(const f of list){const s=scoreFor(f,club);if(!s)continue;gf+=s[0];ga+=s[1];if(s[0]>s[1])wins++;else if(s[0]<s[1])losses++;else draws++}
   return {played:list.length,wins,draws,losses,gf,ga};
  };
  const all=part(rows);
  return {...all,cleanSheets:rows.filter(f=>scoreFor(f,club)?.[1]===0).length,home:part(homeRows),away:part(awayRows),
   matches:rows.map(f=>{const s=scoreFor(f,club);return {kickoff_at:f.kickoff_at,goals:s?.[0]||0,conceded:s?.[1]||0,result:s?.[0]>s?.[1]?'W':s?.[0]<s?.[1]?'L':'D'}})};
 };
 const homeIntelligence=analyseResults(completed,homeClub,{competitions,venues,history,before:fixture.kickoff_at});
 const awayIntelligence=analyseResults(completed,awayClub,{competitions,venues,history,before:fixture.kickoff_at});
 const isSpecificEvent=e=>['yellow_card','red_card','second_yellow','blue_card'].includes(e.event_type)&&['official','community_confirmed'].includes(e.validation_status);
 const validFixtureIds=new Set(completed.map(f=>String(f.id)));
 const matchIds=new Map((matches||[]).map(m=>[String(m.id),String(m.fixture_id)]));
 const specificCount=club=>new Set((events||[]).filter(isSpecificEvent).filter(e=>{
  const fixture=completed.find(f=>String(f.id)===String(e.fixture_id||matchIds.get(String(e.match_id))||''));
  if(!fixture||!validFixtureIds.has(String(fixture.id)))return false;
  return homeId(fixture)===club||awayId(fixture)===club;
 }).map(e=>String(e.fixture_id||matchIds.get(String(e.match_id))))).size;
 const homeProfile=buildTeamProfile({numbers:profileNumbers(homeClub),gameState:homeSituational.gameState,eventMatches:specificCount(homeClub),resultAnalysis:homeIntelligence});
 const awayProfile=buildTeamProfile({numbers:profileNumbers(awayClub),gameState:awaySituational.gameState,eventMatches:specificCount(awayClub),resultAnalysis:awayIntelligence});

 const gameStateScore=situ=>{
  const parts=[];
  if(situ?.trailed>=2&&Number.isFinite(situ.recoveryRate))parts.push(situ.recoveryRate);
  if(situ?.led>=2&&Number.isFinite(situ.leadHoldRate))parts.push(situ.leadHoldRate);
  return parts.length?parts.reduce((a,b)=>a+b,0)/parts.length:.5;
 };
 const stateMatchup=(attack,defense)=>{
  const a=attack?.gameState,d=defense?.gameState;
  if(!a?.matches||!d?.matches)return 0;
  const equalize=(a.roles?.team?.equalizer||0)/a.matches;
  const oppEqualized=(d.roles?.opponent?.equalizer||0)/d.matches;
  const reduce=(a.roles?.team?.deficit_reduction||0)/a.matches;
  const oppReduce=(d.roles?.opponent?.deficit_reduction||0)/d.matches;
  const quick=Math.min(1,(a.quickResponsesFor||0)/Math.max(1,a.matches));
  const vulnerable=Math.min(1,(d.quickResponsesAgainst||0)/Math.max(1,d.matches));
  const signal=.38*Math.min(equalize,oppEqualized)+.24*Math.min(reduce,oppReduce)+.38*Math.min(quick,vulnerable);
  const reliability=clamp(Math.min(a.matches,d.matches)/5,.25,1);
  return .18*clamp(signal,0,1)*reliability;
 };

 const homeGoals=completed.reduce((s,f)=>s+Number(f.home_score||0),0),awayGoals=completed.reduce((s,f)=>s+Number(f.away_score||0),0);
 const homeFactor=clamp(Math.sqrt((homeGoals+4*leagueGoalRate)/(awayGoals+4*leagueGoalRate)),.88,1.15);
 let homeLambda=Math.sqrt(Math.max(.05,home.attackRate)*Math.max(.05,away.defenseRate))*homeFactor;
 let awayLambda=Math.sqrt(Math.max(.05,away.attackRate)*Math.max(.05,home.defenseRate))/homeFactor;

 const strengthDiff=home.strength-away.strength;
 homeLambda*=Math.exp(strengthDiff*.70);awayLambda*=Math.exp(-strengthDiff*.70);
 // Pairwise historical level gap matters most before current-season evidence
 // is mature. This is separate from generic strength so a tier-2 vs tier-3
 // mismatch is not flattened just because both teams had mediocre records.
 const earlyEvidence=Math.min(home.historyWeight??0,away.historyWeight??0);
 const tierGap=clamp((home.historyTier??.5)-(away.historyTier??.5),-.7,.7);
 const priorGap=clamp((home.prior??.5)-(away.prior??.5),-.7,.7);
 const historicalMatchupDelta=earlyEvidence*(.72*tierGap+.28*priorGap);
 homeLambda*=Math.exp(historicalMatchupDelta*1.05);
 awayLambda*=Math.exp(-historicalMatchupDelta*1.05);
 const managementDelta=(homeManagement?.delta||0)-(awayManagement?.delta||0);
 const numericalDelta=(homeNumerical?.delta||0)-(awayNumerical?.delta||0);
 const rankDelta=homeBehavior.delta-awayBehavior.delta;
 const venueDelta=(homeVenue.sample>=2?homeVenue.delta:0)-(awayVenue.sample>=2?awayVenue.delta:0);
 const gameStateDelta=clamp(gameStateScore(homeSituational)-gameStateScore(awaySituational),-.35,.35);
 const statePatternDelta=stateMatchup(homeSituational,awaySituational)-stateMatchup(awaySituational,homeSituational);
 const formSamples=Math.min(homeIntelligence.form.adjustedSample,awayIntelligence.form.adjustedSample);
 const adjustedFormDelta=formSamples>=2&&homeIntelligence.form.opponentAdjusted!=null&&awayIntelligence.form.opponentAdjusted!=null?
  clamp((homeIntelligence.form.opponentAdjusted-awayIntelligence.form.opponentAdjusted)*Math.min(1,formSamples/5),-.3,.3):0;
 const context=.27*rankDelta+.12*managementDelta+.15*gameStateDelta+.15*numericalDelta+.15*venueDelta+
  .10*statePatternDelta+.06*adjustedFormDelta;
 homeLambda*=Math.exp(context);awayLambda*=Math.exp(-context);
 homeLambda=clamp(homeLambda,.15,4.5);awayLambda=clamp(awayLambda,.15,4.5);

 // Forecast is now the distribution of simulated goal-event timelines, not
 // independent full-time Poisson scores subsequently decorated with events.
 const timelineForecast=simulateScoreTimeline({fixtureId:fixture.id,homeLambda,awayLambda,
  homeSituational,awaySituational,
  duration:Math.max(40,Number(competition.minutes_per_period||40)*Number(competition.periods||2))});
 const probability=timelineForecast.probabilities;
 const attention=attentionPoints(fixture.home_team,fixture.away_team,homeComparison,awayComparison,homeSituational,awaySituational);
 const narrative=matchNarrative({
  fixture,probability,expectedGoals:timelineForecast.expectedGoals,home,away,
  homeComparison,awayComparison,homeSituational,awaySituational,homeIntelligence,awayIntelligence,venue:targetVenue,attention
 });
 const factors=[
  {key:'adjusted-form',label:'Forma corretta per rango',home:homeIntelligence.form.opponentAdjusted??.5,away:awayIntelligence.form.opponentAdjusted??.5,
   detail:'Correzione della forma recente sulla forza dell’avversaria stimata prima della gara. Con meno di due precedenti affidabili il correttivo resta neutro.'},
  {key:'profile',label:'Team Profile',home:homeProfile.overall,away:awayProfile.overall,
   detail:'Sintesi degli indicatori disponibili con confidenza A/B/C. Non aggiunge un secondo peso al modello: organizza le stesse feature ed evidenzia quanto sono affidabili.'},
  {key:'form',label:'Forma recente',home:home.recent,away:away.recent,
   detail:home.played&&away.played?'Ultime gare pesate con maggiore importanza alle più recenti.':'Campione ancora ridotto.'},
  {key:'potential',label:'Potenziale atteso',home:home.potential,away:away.potential,
   detail:'Valore sulla carta: storico e livello pregresso, corretti gradualmente dalla qualità strutturale mostrata nella stagione corrente. La forma recente resta separata.'},
  {key:'competition',label:'Andamento competizione',home:home.strength,away:away.strength,
   detail:'Forza attuale ricavata da punti, forma, DR, attacco/difesa e piccolo prior storico.'},
  {key:'rank',label:'Contro squadre di potenziale',home:homeBehavior.rate,away:awayBehavior.rate,
   detail:(homeBehavior.sample||awayBehavior.sample)?
    fixture.home_team+': '+homeBehavior.sample+' precedenti contro '+bucketLabel(homeBehavior.bucket)+' · '+fixture.away_team+': '+awayBehavior.sample+' contro '+bucketLabel(awayBehavior.bucket):
    'Nessun precedente comparabile sufficiente nella competizione.'},
  {key:'management',label:'Gestione vantaggio/svantaggio',home:gameStateScore(homeSituational),away:gameStateScore(awaySituational),
   detail:'Rimonte e mantenimento del vantaggio entrano nel correttivo solo con almeno 2 casi osservabili; campioni insufficienti restano neutrali.'},
  {key:'firstgoal',label:'Primo gol e 3 punti',
   home:homeSituational.scoredFirstWinRate??.5,away:awaySituational.scoredFirstWinRate??.5,
   detail:fixture.home_team+': '+(homeSituational.scoredFirst||0)+' volte avanti per prima, '+(homeSituational.scoredFirstWins||0)+' vittorie · '+
    fixture.away_team+': '+(awaySituational.scoredFirst||0)+' volte avanti per prima, '+(awaySituational.scoredFirstWins||0)+' vittorie. Viene valutato anche il rendimento quando si subisce per primi.'},
  {key:'state-pattern',label:'Pattern sul parziale',home:.5+stateMatchup(homeSituational,awaySituational),away:.5+stateMatchup(awaySituational,homeSituational),
   detail:'Incrocia pareggi, accorciamenti, vantaggi concessi e risposte entro 10 minuti. Usa solo timeline complete.'},
  {key:'numerical',label:'Superiorità / inferiorità',home:homeNumerical?.score??.5,away:awayNumerical?.score??.5,
   detail:(homeNumerical&&!homeNumerical.insufficient)||(awayNumerical&&!awayNumerical.insufficient)?
    'Rendimento dei gol durante periodi realmente giocati con differenza numerica.':
    'Meno di 20 minuti complessivi di campione affidabile: fattore neutro.'},
  {key:'venue',label:'Profilo campo',home:homeVenue.rate,away:awayVenue.rate,
   detail:targetVenue&&venueTraits(targetVenue).length?
    [targetVenue.surface_type,targetVenue.width_profile,targetVenue.length_profile].filter(Boolean).join(' · ')+' · fattore applicato solo con almeno 2 precedenti su profilo simile.':
    'Caratteristiche del campo non ancora configurate.'},
  {key:'history',label:'Storico stagioni passate',home:home.prior,away:away.prior,
   detail:'Incidenza sulla forza: '+Math.round(home.historyShare*100)+'% '+fixture.home_team+' · '+Math.round(away.historyShare*100)+'% '+fixture.away_team+
    '. Il livello della serie è il segnale storico principale e, nelle prime giornate, pesa anche direttamente sul confronto degli xG; poi cala con l’aumentare delle gare correnti.'}
 ];

 const detailedAvailable=Number(Boolean(homeManagement&&!homeManagement.insufficient))+Number(Boolean(awayManagement&&!awayManagement.insufficient))+
  Number(Boolean(homeNumerical&&!homeNumerical.insufficient))+Number(Boolean(awayNumerical&&!awayNumerical.insufficient));
 const venueAvailable=Number(homeVenue.sample>=2)+Number(awayVenue.sample>=2);
 const coreSample=Math.min(home.played,away.played);
 const coverage=Math.round(clamp(.15+.45*Math.min(1,completed.length/Math.max(4,teams.length*2))+
  .25*Math.min(1,coreSample/4)+.10*Math.min(1,detailedAvailable/2)+.05*Math.min(1,venueAvailable/2))*100);

 return {
  fixtureId:fixture.id,
  home:{id:homeClub,name:fixture.home_team,potentialRank:potentialRankOf(homeClub,strengths),potential:home.potential,strength:home.strength,played:home.played},
  away:{id:awayClub,name:fixture.away_team,potentialRank:potentialRankOf(awayClub,strengths),potential:away.potential,strength:away.strength,played:away.played},
  expectedGoals:timelineForecast.expectedGoals,
  probabilities:probability,
  simulation:{trials:timelineForecast.simulations,timeline:timelineForecast.sampleTimeline,evidence:timelineForecast.evidence},
  coverage,
  completedCompetitionMatches:completed.length,
  comparison:{home:homeComparison,away:awayComparison},
  situational:{home:homeSituational,away:awaySituational},
  resultIntelligence:{home:homeIntelligence,away:awayIntelligence},
  profiles:{home:{...homeProfile,highlights:profileHighlights(homeProfile)},away:{...awayProfile,highlights:profileHighlights(awayProfile)}},
  attention,
  comparableFixtureIds:{home:homeComparableFixtures,away:awayComparableFixtures},
  lineupFixtureWeights:{home:homeFixtureRelevance,away:awayFixtureRelevance},
  narrative,
  factors,
  venue:targetVenue?{name:targetVenue.name,surface_type:targetVenue.surface_type,width_profile:targetVenue.width_profile,length_profile:targetVenue.length_profile}:null
 };
}
