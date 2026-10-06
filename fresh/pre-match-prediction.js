import {cumulativeEventMinute} from './match-minutes.js';

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
 if(!rows.length)return {score:.5,seasons:0};
 let sum=0,weightsTotal=0;
 rows.forEach((r,index)=>{
  const tier=Number(r.tier_level),position=Math.max(1,Number(r.final_position)||1);
  const totalPositions=Number(r.total_positions);
  const maxPoints=Math.max(1,Number(r.max_points)||1),earned=clamp(Number(r.points||0)/maxPoints);
  const tierScore=clamp(1-(Math.max(1,tier)-1)*.2,.1,1);
  const absolutePositionScore=clamp(1/(1+.18*(position-1)),.15,1);
  const relativePositionScore=Number.isInteger(totalPositions)&&totalPositions>=2?
   clamp((totalPositions-position)/(totalPositions-1),0,1):absolutePositionScore;
  const base=.55*tierScore+.30*earned+.15*relativePositionScore;
  const gd=Number(r.goal_difference),hasGd=Number.isFinite(gd)&&r.goal_difference!==null&&r.goal_difference!=='';
  const gdScale=Math.max(8,Number.isInteger(totalPositions)?totalPositions:12)*4;
  const seasonScore=hasGd ? .9*base+.1*clamp(.5+gd/gdScale) : base;
  const weight=5-index;sum+=seasonScore*weight;weightsTotal+=weight;
 });
 return {score:weightsTotal?clamp(sum/weightsTotal):.5,seasons:rows.length};
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
  const historyShare=Math.min(.22,.22*historicalWeight(n,totalGames.get(club)));
  const strength=clamp(current*(1-historyShare)+prior.score*historyShare);
  const shrink=n/(n+3);
  raw.set(club,{club,played:n,gf,ga,ppg,recent,gd,current,structural,potential,prior:prior.score,historySeasons:prior.seasons,
   historyShare,strength,totalGames:totalGames.get(club)||0,
   attackRate:leagueGoalRate*(1-shrink)+(n?gf/n:leagueGoalRate)*shrink,
   defenseRate:leagueGoalRate*(1-shrink)+(n?ga/n:leagueGoalRate)*shrink});
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
  if(e.validation_status==='rejected')continue;
  const f=eventFixture(e,matchesById,fixturesById);if(!f)continue;
  const list=byFixture.get(key(f.id))||[];list.push(e);byFixture.set(key(f.id),list);
 }
 let timelineSample=0,trailed=0,recovered=0,comebackWins=0,led=0,heldLead=0,lostLead=0;
 let opponentReds=0,ownReds=0,cardSample=0;
 for(const f of completed.filter(x=>homeId(x)===club||awayId(x)===club)){
  const all=byFixture.get(key(f.id))||[];
  cardSample++;
  for(const e of all){
   if(!['red_card','second_yellow'].includes(e.event_type))continue;
   const receiver=eventClub(e,f,primaryTeam,false);
   if(receiver===club)ownReds++;else if(receiver)opponentReds++;
  }
  const goals=all.filter(e=>goalTypes.has(e.event_type)&&e.payload?.count_score!==false);
  if(goals.length!==Number(f.home_score)+Number(f.away_score)||goals.some(e=>!Number.isInteger(e.minute)))continue;
  const comp=(competitions||[]).find(x=>key(x.id)===key(f.competition_id));
  goals.sort((a,b)=>(cumulativeEventMinute(a,comp)??999)-(cumulativeEventMinute(b,comp)??999)||
   Number(a.stoppage_minute||0)-Number(b.stoppage_minute||0)||String(a.created_at||'').localeCompare(String(b.created_at||'')));
  let ours=0,theirs=0,wasBehind=false,wasAhead=false,reachedEqualAfterBehind=false,reachedEqualAfterAhead=false;
  for(const e of goals){
   const scorer=eventClub(e,f,primaryTeam,true);if(!scorer)continue;
   if(scorer===club)ours++;else theirs++;
   if(ours<theirs)wasBehind=true;if(ours>theirs)wasAhead=true;
   if(wasBehind&&ours>=theirs)reachedEqualAfterBehind=true;
   if(wasAhead&&ours<=theirs)reachedEqualAfterAhead=true;
  }
  timelineSample++;
  const s=scoreFor(f,club);if(!s)continue;
  if(wasBehind){trailed++;if(reachedEqualAfterBehind)recovered++;if(s[0]>s[1])comebackWins++}
  if(wasAhead){led++;if(s[0]>s[1])heldLead++;if(reachedEqualAfterAhead)lostLead++}
 }
 return {timelineSample,trailed,recovered,comebackWins,led,heldLead,lostLead,cardSample,opponentReds,ownReds,
  recoveryRate:trailed?recovered/trailed:null,leadHoldRate:led?heldLead/led:null,
  opponentRedRate:cardSample?opponentReds/cardSample:null,ownRedRate:cardSample?ownReds/cardSample:null};
}
function attentionPoints(homeName,awayName,homeBase,awayBase,homeSitu,awaySitu){
 const out=[];
 const push=(club,label,value,detail,tone='watch')=>out.push({club,label,value,detail,tone});
 const inspect=(name,base,situ)=>{
  if(base.played>=2&&base.recentPpg-base.ppg>=.5)push(name,'Forma in crescita','↑',base.recentPpg.toFixed(2)+' punti/gara nelle ultime contro '+base.ppg.toFixed(2)+' complessivi','strength');
  if(base.played>=2&&base.ppg-base.recentPpg>=.5)push(name,'Forma in calo','↓',base.recentPpg.toFixed(2)+' punti/gara recenti contro '+base.ppg.toFixed(2)+' complessivi','risk');
  if(situ.trailed>=2&&situ.recoveryRate>=.5)push(name,'Rimonta spesso',Math.round(situ.recoveryRate*100)+'%',situ.recovered+' recuperi dopo essere andata sotto in '+situ.trailed+' casi','strength');
  if(situ.led>=2&&situ.leadHoldRate>=.75)push(name,'Protegge bene il vantaggio',Math.round(situ.leadHoldRate*100)+'%',situ.heldLead+' vittorie dopo essere passata avanti in '+situ.led+' gare','strength');
  if(situ.led>=2&&situ.lostLead/situ.led>=.5)push(name,'Vantaggio vulnerabile',Math.round(100*situ.lostLead/situ.led)+'%',situ.lostLead+' volte raggiunta dopo essere passata avanti','risk');
  if(situ.cardSample>=2&&situ.opponentRedRate>=.25)push(name,'Fa espellere avversari',situ.opponentReds,situ.opponentReds+' espulsioni avversarie in '+situ.cardSample+' gare con eventi disponibili','watch');
  if(situ.cardSample>=2&&situ.ownRedRate>=.25)push(name,'Rischio disciplina',situ.ownReds,situ.ownReds+' espulsioni proprie in '+situ.cardSample+' gare con eventi disponibili','risk');
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
function matchNarrative(fixture,probability,expectedGoals,attention=[]){
 const pairs=[['home',probability.home,fixture.home_team],['draw',probability.draw,'il pareggio'],['away',probability.away,fixture.away_team]]
  .sort((a,b)=>b[1]-a[1]);
 const top=pairs[0],gap=top[1]-pairs[1][1],total=Number(expectedGoals.home||0)+Number(expectedGoals.away||0);
 let opening='';
 if(gap<.08)opening='Il modello si aspetta una gara equilibrata, senza un esito nettamente dominante.';
 else if(top[0]==='draw')opening='Il pareggio è l’esito singolo più probabile, con valori complessivamente vicini.';
 else opening=top[2]+' parte con un vantaggio statistico '+(gap>.18?'abbastanza marcato':'contenuto')+'.';
 let rhythm=total>=3.1?'Il profilo suggerisce una partita piuttosto aperta, con diverse occasioni e possibilità di cambi di inerzia.':
  total<=1.8?'Il volume offensivo atteso è basso: è più probabile una gara chiusa, in cui il primo gol può pesare molto.':
  'Il numero di gol atteso è intermedio: la partita potrebbe restare in equilibrio per una parte consistente della gara.';
 const notable=attention.find(x=>/Rimonta|Vantaggio|espellere|disciplina|Produzione offensiva/i.test(x.label));
 const detail=notable?' Da monitorare soprattutto '+notable.club.toLowerCase()+' per '+notable.label.toLowerCase()+'.':'';
 return opening+' '+rhythm+detail;
}
function factorial(n){let r=1;for(let i=2;i<=n;i++)r*=i;return r}
function poissonProbability(k,lambda){return Math.exp(-lambda)*Math.pow(lambda,k)/factorial(k)}
function outcomeProbabilities(homeLambda,awayLambda){
 let home=0,draw=0,away=0,total=0,best={home:0,away:0,p:-1};
 for(let h=0;h<=10;h++)for(let a=0;a<=10;a++){
  const p=poissonProbability(h,homeLambda)*poissonProbability(a,awayLambda);total+=p;
  if(h>a)home+=p;else if(h<a)away+=p;else draw+=p;
  if(p>best.p)best={home:h,away:a,p};
 }
 if(total>0){home/=total;draw/=total;away/=total}
 return {home,draw,away,mostLikely:{home:best.home,away:best.away,probability:best.p/Math.max(total,1e-9)}};
}
function potentialRankOf(club,strengths){
 return 1+[...strengths.values()].filter(x=>x.potential>(strengths.get(club)?.potential??.5)).length;
}
function bucketLabel(bucket){return bucket==='higher'?'potenziale superiore':bucket==='lower'?'potenziale inferiore':'potenziale simile'}

export function predictionSignature({fixture,fixtures=[],history=[],venues=[],events=[]}={}){
 return JSON.stringify([
  fixture?.id,fixture?.kickoff_at,fixture?.competition_id,
  fixtures.filter(f=>f.competition_id===fixture?.competition_id).map(f=>[f.id,f.status,f.kickoff_at,homeId(f),awayId(f),f.home_score,f.away_score,f.venue_name||f.venue]).sort(),
  history.map(r=>[identity(r.team_id,r.opponent_id),r.season_start_year,r.tier_level,r.final_position,r.total_positions,r.points,r.max_points,r.goal_difference]).sort(),
  venues.map(v=>[v.id,v.name,v.surface_type,v.width_profile,v.length_profile]).sort(),
  events.map(e=>[e.id,e.match_id,e.event_type,e.minute,e.stoppage_minute,e.team_side,e.validation_status,e.payload?.count_score]).sort()
 ]);
}

export function predictMatch({fixture,competition,fixtures=[],history=[],venues=[],matches=[],events=[],team,competitions=[]}={}){
 if(!fixture?.id||!competition?.id)return null;
 if(['live','finished','cancelled'].includes(fixture.status))return null;
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

 const homeGoals=completed.reduce((s,f)=>s+Number(f.home_score||0),0),awayGoals=completed.reduce((s,f)=>s+Number(f.away_score||0),0);
 const homeFactor=clamp(Math.sqrt((homeGoals+4*leagueGoalRate)/(awayGoals+4*leagueGoalRate)),.88,1.15);
 let homeLambda=Math.sqrt(Math.max(.05,home.attackRate)*Math.max(.05,away.defenseRate))*homeFactor;
 let awayLambda=Math.sqrt(Math.max(.05,away.attackRate)*Math.max(.05,home.defenseRate))/homeFactor;

 const strengthDiff=home.strength-away.strength;
 homeLambda*=Math.exp(strengthDiff*.70);awayLambda*=Math.exp(-strengthDiff*.70);
 const managementDelta=(homeManagement?.delta||0)-(awayManagement?.delta||0);
 const numericalDelta=(homeNumerical?.delta||0)-(awayNumerical?.delta||0);
 const rankDelta=homeBehavior.delta-awayBehavior.delta;
 const venueDelta=(homeVenue.sample>=2?homeVenue.delta:0)-(awayVenue.sample>=2?awayVenue.delta:0);
 const context=.30*rankDelta+.22*managementDelta+.18*numericalDelta+.20*venueDelta;
 homeLambda*=Math.exp(context);awayLambda*=Math.exp(-context);
 homeLambda=clamp(homeLambda,.15,4.5);awayLambda=clamp(awayLambda,.15,4.5);

 const probability=outcomeProbabilities(homeLambda,awayLambda);
 const homeComparison=comparisonMetrics(homeClub,completed,competition),awayComparison=comparisonMetrics(awayClub,completed,competition);
 const homeSituational=situationalMetrics(homeClub,completed,matches,events,competitions,team);
 const awaySituational=situationalMetrics(awayClub,completed,matches,events,competitions,team);
 const attention=attentionPoints(fixture.home_team,fixture.away_team,homeComparison,awayComparison,homeSituational,awaySituational);
 const narrative=matchNarrative(fixture,probability,{home:homeLambda,away:awayLambda},attention);
 const factors=[
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
  {key:'management',label:'Gestione vantaggio/svantaggio',home:homeManagement?.score??.5,away:awayManagement?.score??.5,
   detail:homeManagement||awayManagement?
    'Usati solo tabellini con sequenza gol completa; campioni insufficienti restano neutrali.':
    'Timeline dettagliata non disponibile per queste squadre.'},
  {key:'numerical',label:'Superiorità / inferiorità',home:homeNumerical?.score??.5,away:awayNumerical?.score??.5,
   detail:(homeNumerical&&!homeNumerical.insufficient)||(awayNumerical&&!awayNumerical.insufficient)?
    'Rendimento dei gol durante periodi realmente giocati con differenza numerica.':
    'Meno di 20 minuti complessivi di campione affidabile: fattore neutro.'},
  {key:'venue',label:'Profilo campo',home:homeVenue.rate,away:awayVenue.rate,
   detail:targetVenue&&venueTraits(targetVenue).length?
    [targetVenue.surface_type,targetVenue.width_profile,targetVenue.length_profile].filter(Boolean).join(' · ')+' · fattore applicato solo con almeno 2 precedenti su profilo simile.':
    'Caratteristiche del campo non ancora configurate.'},
  {key:'history',label:'Storico stagioni passate',home:home.prior,away:away.prior,
   detail:'Incidenza attuale: '+Math.round(home.historyShare*100)+'% '+fixture.home_team+' · '+Math.round(away.historyShare*100)+'% '+fixture.away_team+'.'}
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
  expectedGoals:{home:homeLambda,away:awayLambda},
  probabilities:probability,
  coverage,
  completedCompetitionMatches:completed.length,
  comparison:{home:homeComparison,away:awayComparison},
  situational:{home:homeSituational,away:awaySituational},
  attention,
  comparableFixtureIds:{home:homeComparableFixtures,away:awayComparableFixtures},
  lineupFixtureWeights:{home:homeFixtureRelevance,away:awayFixtureRelevance},
  narrative,
  factors,
  venue:targetVenue?{name:targetVenue.name,surface_type:targetVenue.surface_type,width_profile:targetVenue.width_profile,length_profile:targetVenue.length_profile}:null
 };
}
