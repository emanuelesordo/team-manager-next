import {formationModules} from './lineup-pitch.js';
import {shirtSvg} from './kit-editor.js';
import {availabilityDefault} from './availability.js';
import {matchPlayerLabel} from './match-player-label.js';
import {matchPlayerIntervals} from './player-participation.js?v=20261014periodpriority1';
import {POSITION_SPOTS} from './player-role-heatmap.js';

const key=v=>String(v??'');
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const roleOf=p=>String(p?.generic_role_manual||p?.role||'').toUpperCase();
const dateOnly=v=>String(v||'').slice(0,10);
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));

function eligibleRoster(data,fixtureDate){
 const day=dateOnly(fixtureDate);
 const periods=data.contracts||[];
 return (data.roster||[]).filter(r=>r.active!==false).filter(r=>{
  const own=periods.filter(p=>p.player_id===r.player_id);
  if(!own.length)return true;
  return own.some(p=>(!p.start_date||p.start_date<=day)&&(!p.end_date||p.end_date>=day));
 });
}
function fixtureForMatch(match,data){
 return (data.fixtures||[]).find(f=>key(f.id)===key(match?.fixture_id))||null;
}
function resultQuality(match,data,team){
 const f=fixtureForMatch(match,data);if(!f||!team?.id)return .5;
 const home=key(f.home_team_id)===key(team.id),away=key(f.away_team_id)===key(team.id);
 if(home===away)return .5;
 const gf=home?Number(f.home_score):Number(f.away_score),ga=home?Number(f.away_score):Number(f.home_score);
 if(!Number.isFinite(gf)||!Number.isFinite(ga))return .5;
 return gf>ga?1:(gf===ga ? .55 : .1);
}
function matchRelevance(match,fixtureWeights,data){
 const f=fixtureForMatch(match,data);
 return clamp(Number(fixtureWeights?.[f?.id]??.55),.35,1);
}
function recencyMap(matches){
 const ordered=matches.slice().sort((a,b)=>Date.parse(a.kickoff_at)-Date.parse(b.kickoff_at));
 return new Map(ordered.map((m,i)=>[key(m.id),.75+.55*(i/Math.max(1,ordered.length-1))]));
}
function modalFormation(matches,fixtureWeights,data,team){
 const weights=new Map(),recency=recencyMap(matches);
 for(const m of matches){
  const f=formationModules.includes(m.formation)?m.formation:null;if(!f)continue;
  const relevance=matchRelevance(m,fixtureWeights,data),result=resultQuality(m,data,team),recent=recency.get(key(m.id))||1;
  const w=recent*(.65+.8*relevance)*(.85+.3*result);
  weights.set(f,(weights.get(f)||0)+w);
 }
 return [...weights].sort((a,b)=>b[1]-a[1])[0]?.[0]||'4-4-2';
}
/** Historical tactical preference, with opponent relevance and observed result. */
function formationHistory(matches,fixtureWeights,data,team){
 const recency=recencyMap(matches),rows=new Map();
 for(const m of matches){
  if(!formationModules.includes(m.formation))continue;
  const weight=(recency.get(key(m.id))||1)*(.65+.8*matchRelevance(m,fixtureWeights,data))*(.85+.3*resultQuality(m,data,team));
  const old=rows.get(m.formation)||{weight:0,observations:0};
  old.weight+=weight;old.observations++;rows.set(m.formation,old);
 }
 const peak=Math.max(1,...[...rows.values()].map(x=>x.weight));
 return new Map([...rows].map(([formation,row])=>[formation,{...row,preference:row.weight/peak}]));
}
function roleTargets(formation){
 const nums=String(formation||'4-4-2').split('-').map(Number);
 const out=['P'];
 nums.forEach((count,index)=>{
  const role=index===0?'D':index===nums.length-1?'A':'C';
  for(let i=0;i<count;i++)out.push(role);
 });
 return out;
}
function spread(count,min,max){
 if(count<=1)return [50];
 const step=(max-min)/(count-1);
 return Array.from({length:count},(_,i)=>min+step*i);
}
function prematchPositions(formation){
 const nums=String(formation||'4-4-2').split('-').map(Number);
 const valid=nums.length>=2&&nums.length<=5&&nums.every(n=>Number.isInteger(n)&&n>0)&&nums.reduce((a,b)=>a+b,0)===10?nums:[4,4,2];
 const rows=[{slot:1,x:50,y:86}];let slot=2;
 valid.forEach((count,index)=>{
  const y=valid.length===1?42:68-(52*index/(valid.length-1));
  let min=15,max=85;
  if(count===1){min=max=50}
  else if(count===2){min=32;max=68}
  else if(count===3){min=21;max=79}
  const xs=spread(count,min,max);
  xs.forEach(x=>rows.push({slot:slot++,x,y}));
 });
 return rows;
}
function availabilityFor(playerId,{targetMatch,data,matchData,competition}){
 const saved=(matchData?.players||[]).find(p=>p.player_id===playerId)||
  (data.priorSelections||[]).find(p=>p.match_id===targetMatch?.id&&p.player_id===playerId);
 return availabilityDefault({
  saved,injuries:data.injuries||[],suspensions:data.suspensions||[],playerId,
  fixtureDate:targetMatch?.kickoff_at,priorSelections:data.priorSelections||[],matches:data.matches||[],
  matchId:targetMatch?.id,disciplinaryEvents:data.disciplinaryEvents||[],competitionId:targetMatch?.competition_id,
  competitionRules:competition?.discipline_rules||{},competitionLinks:data.competitionLinks||[]
 });
}
/** Recent form is a small, evidence-weighted deviation from the observed season
 * mean. Opponent relevance comes from the prediction model, not invented ranks. */
export function recentOpponentForm(playerId,data,matches,fixtureWeights,baseline){
 if(!finite(baseline))return {delta:0,samples:0};
 const matchById=new Map(matches.map(m=>[key(m.id),m]));
 const entries=(data.seasonRatings||[]).filter(x=>key(x.player_id)===key(playerId)&&matchById.has(key(x.match_id))&&finite(x.rating)&&Number(x.rating)>=1&&Number(x.rating)<=10);
 const grouped=new Map();
 for(const row of entries){const id=key(row.match_id),g=grouped.get(id)||{sum:0,n:0};g.sum+=Number(row.rating);g.n++;grouped.set(id,g)}
 const recent=[...grouped].map(([id,row])=>({m:matchById.get(id),value:row.sum/row.n})).sort((a,b)=>Date.parse(b.m.kickoff_at)-Date.parse(a.m.kickoff_at)).slice(0,5);
 let total=0,weight=0;
 recent.forEach(({m,value},index)=>{
  const w=(1-index*.13)*(.4+.6*matchRelevance(m,fixtureWeights,data));
  total+=(value-Number(baseline))*w;weight+=w;
 });
 return {delta:recent.length?clamp(total/Math.max(weight,1)*clamp(recent.length/4),-.65,.65):0,samples:recent.length};
}
/** Penalize moving away from the natural area; a secondary role can still
 * work, but the projected output must reflect the transition. */
export function positionalAdjustment(playerId,slotPosition,targetRole,data){
 const fit=roleFitForSlot(playerId,slotPosition,targetRole,data);
 if(!fit)return {ratingPenalty:0,movement:0,fit:null};
 const natural=(data.roleAffinities||[]).find(x=>key(x.player_id)===key(playerId)&&x.is_natural);
 const naturalCode=(data.rolePositions||[]).find(x=>key(x.id)===key(natural?.position_id))?.code;
 const point=POSITION_SPOTS[naturalCode];
 const distance=point?Math.hypot((slotPosition.x-point[0])/100,(slotPosition.y-point[1])/100):0;
 const movement=clamp(distance/.8);
 const loss=clamp(1-fit.fit,0,1);
 return {ratingPenalty:clamp(.75*loss+.35*movement*loss,0,1.05),movement,fit};
}

function ratingAverages(data,matches,fixtureWeights,team){
 const allowed=new Set(matches.map(m=>key(m.id))),matchById=new Map(matches.map(m=>[key(m.id),m]));
 const grouped=new Map();
 for(const r of data.seasonRatings||[]){
  if(!allowed.has(key(r.match_id))||!finite(r.rating))continue;
  const rating=Number(r.rating);if(rating<1||rating>10)continue;
  const k=key(r.match_id)+'|'+key(r.player_id),row=grouped.get(k)||{sum:0,n:0};
  row.sum+=rating;row.n++;grouped.set(k,row);
 }
 const recency=recencyMap(matches),byPlayer=new Map();
 for(const [compound,row] of grouped){
  const [matchId,playerId]=compound.split('|'),m=matchById.get(matchId);if(!m)continue;
  const avg=row.sum/row.n,relevance=matchRelevance(m,fixtureWeights,data),result=resultQuality(m,data,team),recent=recency.get(matchId)||1;
  const weight=recent*(.55+.95*relevance)*(.88+.24*result);
  const p=byPlayer.get(playerId)||{plainSum:0,plainN:0,weightedSum:0,weight:0,matchN:0};
  p.plainSum+=avg;p.plainN++;p.weightedSum+=avg*weight;p.weight+=weight;p.matchN++;byPlayer.set(playerId,p);
 }
 const seasonStats=new Map((data.playerStats||[]).map(x=>[key(x.player_id),x]));
 const roleBuckets=new Map();let teamSum=0,teamN=0;
 for(const p of data.players||[]){
  const stat=seasonStats.get(key(p.id));if(!finite(stat?.avg_rating))continue;
  const value=Number(stat.avg_rating),role=roleOf(p)||'GEN';
  const bucket=roleBuckets.get(role)||{sum:0,n:0};bucket.sum+=value;bucket.n++;roleBuckets.set(role,bucket);
  teamSum+=value;teamN++;
 }
 const teamAverage=teamN?teamSum/teamN:null;
 const result=new Map();
 for(const p of data.players||[]){
  const row=byPlayer.get(key(p.id)),stat=seasonStats.get(key(p.id)),role=roleOf(p)||'GEN';
  const roleBucket=roleBuckets.get(role),roleAverage=roleBucket?.n?roleBucket.sum/roleBucket.n:null;
  const fallback=finite(stat?.avg_rating)?Number(stat.avg_rating):(finite(roleAverage)?Number(roleAverage):(finite(teamAverage)?Number(teamAverage):null));
  // A displayed historical mean must be observed; role/team means are only predictive priors.
  const mean=finite(stat?.avg_rating)?Number(stat.avg_rating):(row?.plainN?row.plainSum/row.plainN:null);
  const context=row?.weight?row.weightedSum/row.weight:fallback;
  result.set(key(p.id),{mean,context,votes:row?.plainN||0,fallbackSource:finite(stat?.avg_rating)?'season':finite(roleAverage)?'role':finite(teamAverage)?'team':'none'});
 }
 return result;
}
function pairKey(a,b){return [key(a),key(b)].sort().join('|')}
function overlapMinutes(a,b){
 let total=0;
 for(const [aStart,aEnd] of a)for(const [bStart,bEnd] of b)
  total+=Math.max(0,Math.min(aEnd,bEnd)-Math.max(aStart,bStart));
 return total;
}
function coPlayMap(matches,data,events,competitions,fixtureWeights,team){
 const pairs=new Map(),selections=data.priorSelections||[];
 if(data.playerSeasonFacts?.complete===false)return pairs;
 const cached=data.playerSeasonFacts?.perMatch;
 for(const m of matches){
  const own=selections.filter(s=>key(s.match_id)===key(m.id));
  if(own.length<2)continue;
  const comp=(competitions||[]).find(x=>key(x.id)===key(m.competition_id))||{};
  const timeline=cached?.get(key(m.id))||matchPlayerIntervals(m,own,
   (events||[]).filter(e=>key(e.match_id)===key(m.id)),comp);
  if(!timeline.valid)continue;
  const list=[...timeline.players.entries()].filter(([,p])=>p.valid&&p.minutes>0);
  const quality=resultQuality(m,data,team),relevance=matchRelevance(m,fixtureWeights,data);
  for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
   const [a,pa]=list[i],[b,pb]=list[j];
   const minutes=overlapMinutes(pa.intervals,pb.intervals);
   if(minutes<=0)continue;
   const k=pairKey(a,b),row=pairs.get(k)||{minutes:0,quality:0};
   const weighted=minutes*(.6+.8*relevance);
   row.minutes+=weighted;row.quality+=weighted*quality;pairs.set(k,row);
  }
 }
 const score=new Map();
 for(const [k,row] of pairs){
  const raw=row.minutes?row.quality/row.minutes:.5,reliability=clamp(row.minutes/80);
  score.set(k,{score:.5*(1-reliability)+raw*reliability,minutes:row.minutes});
 }
 return score;
}

// Fit uses the staff-configured specific position profile, not just P/D/C/A.
// Unknown profiles retain the original category prior, whereas a configured
// 0% is an explicit signal of incompatibility. The pitch geometry is shared
// with the player role heatmap and uses the same orientation.
export function roleFitForSlot(playerId,slotPosition,targetRole,data){
 const catalog=new Map((data.rolePositions||[]).map(p=>[key(p.id),p]));
 const roles=(data.roleAffinities||[]).filter(x=>key(x.player_id)===key(playerId))
  .map(x=>({position:catalog.get(key(x.position_id)),affinity:Number(x.affinity_pct)}))
  .filter(x=>x.position&&Number.isFinite(x.affinity)&&POSITION_SPOTS[x.position.code]);
 if(!roles.length)return null;
 const targetGroup=targetRole;
 const groupOf=p=>({goalkeeper:'P',defender:'D',midfielder:'C',forward:'A'})[p?.category];
 let best=0,matched=null;
 for(const {position,affinity} of roles){
  const group=groupOf(position);
  if(group!==targetGroup||affinity<=0)continue;
  const [x,y]=POSITION_SPOTS[position.code];
  const dx=(Number(slotPosition.x)-x)/100,dy=(Number(slotPosition.y)-y)/100;
  const distance=Math.hypot(dx*1.1,dy*1.2);
  const proximity=clamp(1-distance/.76,.12,1);
  const fit=(affinity/100)*(0.65+0.35*proximity);
  if(fit>best){best=fit;matched=position.code}
 }
 // For configured profiles an out-of-category position must be exceptional:
 // give a tiny fallback only when no candidate covers a slot.
 return {fit:best,roleCode:matched,configured:true};
}
function coachOpportunityMap(matches,selections,fixtureWeights,data,team){
 const byMatch=new Map(matches.map(m=>[key(m.id),m]));
 const selected=new Map();
 for(const row of selections){
  if(!byMatch.has(key(row.match_id)))continue;
  const id=key(row.player_id),m=byMatch.get(key(row.match_id));
  const group=selected.get(key(m.id))||[];
  group.push(row);selected.set(key(m.id),group);
 }
 const eligibleByPlayer=new Map(),choicesByPlayer=new Map();
 for(const m of matches){
  const entries=selected.get(key(m.id))||[];
  // Only complete-enough historical sheets demonstrate the coach's choice.
  if(entries.length<10)continue;
  const relevance=matchRelevance(m,fixtureWeights,data);
  const w=(.55+.85*relevance)*(.85+.25*resultQuality(m,data,team));
  for(const row of entries){
   if(row.selection_status==='absent'||row.unavailability_reason)continue;
   const id=key(row.player_id);
   eligibleByPlayer.set(id,(eligibleByPlayer.get(id)||0)+w);
   if(row.started||row.selection_status==='starter')
    choicesByPlayer.set(id,(choicesByPlayer.get(id)||0)+w);
  }
 }
 const ratios=new Map();
 for(const [id,opportunities] of eligibleByPlayer){
  ratios.set(id,{rate:(choicesByPlayer.get(id)||0)/opportunities,opportunities});
 }
 return ratios;
}

function playerScores(players,allPriorMatches,sampleMatches,selections,formation,fixtureWeights,data,team,ratings){
 const allIds=new Set(allPriorMatches.map(m=>key(m.id))),sampleIds=new Set(sampleMatches.map(m=>key(m.id)));
 const formIds=new Set(sampleMatches.filter(m=>m.formation===formation).map(m=>key(m.id)));
 const matchById=new Map(allPriorMatches.map(m=>[key(m.id),m])),recency=recencyMap(allPriorMatches);
 const score=new Map(),slotScore=new Map(),shirts=new Map(),resultScore=new Map();
 for(const s of selections){
  if(!allIds.has(key(s.match_id))||!(s.started||s.selection_status==='starter'))continue;
  const m=matchById.get(key(s.match_id));if(!m)continue;
  const recent=recency.get(key(m.id))||1,relevance=matchRelevance(m,fixtureWeights,data),result=resultQuality(m,data,team);
  const sampleBoost=sampleIds.has(key(m.id))?1.35:.55;
  const w=recent*(.55+.9*relevance)*(.75+.45*result);
  score.set(key(s.player_id),(score.get(key(s.player_id))||0)+sampleBoost*w);
  const rs=resultScore.get(key(s.player_id))||{sum:0,w:0};rs.sum+=result*w;rs.w+=w;resultScore.set(key(s.player_id),rs);
  if(formIds.has(key(s.match_id))&&Number.isInteger(Number(s.tactical_slot))){
   const k=key(s.player_id)+'|'+Number(s.tactical_slot);
   slotScore.set(k,(slotScore.get(k)||0)+1.8*w);
  }
  if(s.shirt_number)shirts.set(key(s.player_id),s.shirt_number);
 }
 const coachChoices=coachOpportunityMap(allPriorMatches,selections,fixtureWeights,data,team);
 const metrics=new Map();
 for(const p of players){
  const r=ratings.get(key(p.player_id))||{},rs=resultScore.get(key(p.player_id));
  const recentMatches=allPriorMatches.slice().sort((a,b)=>Date.parse(b.kickoff_at)-Date.parse(a.kickoff_at)).slice(0,3);
  const recentIds=new Set(recentMatches.map(m=>key(m.id)));
  const recentRows=selections.filter(s=>key(s.player_id)===key(p.player_id)&&recentIds.has(key(s.match_id)));
  const recentStarts=recentRows.filter(s=>s.started||s.selection_status==='starter').length;
  const intervals=data.playerSeasonFacts?.perMatch;
  const recentValues=recentRows.map(s=>intervals?.get(key(s.match_id))?.players.get(key(s.player_id))?.minutes);
  const recentMinutes=recentValues.length&&recentValues.every(Number.isFinite)
   ?recentValues.reduce((sum,n)=>sum+n,0):null;
  metrics.set(key(p.player_id),{
   general:score.get(key(p.player_id))||0,
   meanRating:r.mean??null,contextRating:r.context??r.mean??null,ratingMatches:r.votes||0,
   resultQuality:rs?.w?rs.sum/rs.w:.5,
   coachChoice:coachChoices.get(key(p.player_id))||null,
   recentStarts,recentMinutes,recentMatchCount:recentMatches.length
  });
 }
 return {score,slotScore,shirts,metrics};
}
function synergyWithUsed(playerId,used,coPlay){
 if(!used.size)return .5;
 let total=0,n=0;
 for(const id of used){
  const row=coPlay.get(pairKey(playerId,id));if(!row)continue;
  const reliability=clamp(row.minutes/120);
  total+=(row.score*reliability+.5*(1-reliability));n++;
 }
 return n?total/n:.5;
}
function bestForSlot(candidates,used,slot,targetRole,scores,coPlay,rotationOpportunity=0,slotPosition=null,data={}){
 let best=null,bestScore=-Infinity;
 for(const c of candidates){
  if(used.has(key(c.player_id)))continue;
  const id=key(c.player_id),role=roleOf(c.person),specific=slotPosition?roleFitForSlot(id,slotPosition,targetRole,data):null;
  const roleFit=specific?(-2+specific.fit*7.2):(role===targetRole?3.2:((targetRole==='C'&&['D','A'].includes(role))?.35:0));
  const slotFit=scores.slotScore.get(id+'|'+slot)||0,general=scores.score.get(id)||0,m=scores.metrics.get(id)||{};
  const rating=finite(m.contextRating)?(Number(m.contextRating)-6)*1.15:0;
  const result=(Number(m.resultQuality||.5)-.5)*1.6;
  const coach=m.coachChoice?.opportunities>=1.5?(m.coachChoice.rate-.5)*1.8:0;
  const synergy=(synergyWithUsed(id,used,coPlay)-.5)*2.2;
  const recentLoad=(m.recentMatchCount?m.recentStarts/Math.max(1,m.recentMatchCount):0)*.65+
   (m.recentMinutes==null ? .18 : clamp(m.recentMinutes/(Math.max(1,m.recentMatchCount||1)*80),0,1)*.35);
  const ratingTrust=finite(m.contextRating)?clamp((Number(m.contextRating)-5.8)/1.8,0,1):.45;
  // Turnover is a soft pressure, never a hard exclusion: in clearly favorable
  // matches heavily-used starters lose a little priority, while reliable alternatives
  // become more competitive. Goalkeepers are deliberately almost unaffected.
  const turnoverPenalty=rotationOpportunity*(role==='P'?.12:1.15)*recentLoad*(.75+.25*ratingTrust);
  const rotationBonus=rotationOpportunity*(role==='P'?0:.42)*(1-recentLoad)*(.55+.45*ratingTrust);
  const value=slotFit+general+roleFit+rating+result+coach+synergy-turnoverPenalty+rotationBonus+(slot===1&&role==='P'?8:0)-(slot===1&&role!=='P'?8:0);
  if(value>bestScore){best=c;bestScore=value}
 }
 return best?{...best,selectionScore:bestScore}:null;
}
function expectedRatingFor(playerId,xiIds,scores,coPlay,positionAdjustment={ratingPenalty:0},recentForm={delta:0}){
 const m=scores.metrics.get(key(playerId))||{},mean=finite(m.meanRating)?Number(m.meanRating):null,context=finite(m.contextRating)?Number(m.contextRating):mean;
 if(mean==null&&context==null)return {meanRating:null,expectedRating:null,matches:0};
 const others=new Set([...xiIds].filter(id=>id!==key(playerId))),synergy=synergyWithUsed(playerId,others,coPlay);
 let expected=context??mean;
 if(mean!=null&&context!=null)expected=.55*mean+.45*context;
 expected+=clamp((synergy-.5)*.55,-.28,.28)+clamp((Number(m.resultQuality||.5)-.5)*.22,-.11,.11);
 expected+=recentForm.delta||0;
 expected-=positionAdjustment.ratingPenalty||0;
 return {meanRating:mean,expectedRating:clamp(expected,1,10),matches:m.ratingMatches||0,synergy};
}
export function buildHypotheticalLineup({fixture,targetMatch,data,matchData,team,competition,competitions=[],prediction,kit,events=[]}={}){
 if(!fixture||!team?.id||!data)return null;
 targetMatch=targetMatch||{id:null,kickoff_at:fixture.kickoff_at,competition_id:fixture.competition_id};
 const teamSide=fixture.home_team_id===team.id?'home':fixture.away_team_id===team.id?'away':null;
 if(!teamSide)return null;
 const kickoff=Date.parse(fixture.kickoff_at||'');
 const ownPrior=(data.matches||[]).filter(m=>m.fixture_id&&m.status==='finished'&&Date.parse(m.kickoff_at)<kickoff);
 const comparableIds=new Set((prediction?.comparableFixtureIds?.[teamSide]||[]).map(key));
 const fixtureWeights=prediction?.lineupFixtureWeights?.[teamSide]||{};
 let sample=ownPrior.filter(m=>comparableIds.has(key(m.fixture_id)));
 if(!sample.length)sample=ownPrior.slice(-4);
 const preferredFormation=modalFormation(sample.length?sample:ownPrior,fixtureWeights,data,team);
 const history=formationHistory(sample.length?sample:ownPrior,fixtureWeights,data,team);
 const teamProbability=teamSide==='home'?Number(prediction?.probabilities?.home||0):Number(prediction?.probabilities?.away||0);
 const ourPotential=teamSide==='home'?Number(prediction?.home?.potential||.5):Number(prediction?.away?.potential||.5);
 const oppPotential=teamSide==='home'?Number(prediction?.away?.potential||.5):Number(prediction?.home?.potential||.5);
 const potentialEdge=ourPotential-oppPotential;
 const rotationOpportunity=clamp(Math.max(0,(teamProbability-.55)/.22)*.65+Math.max(0,(potentialEdge-.05)/.22)*.35,0,1);
 const roster=eligibleRoster(data,fixture.kickoff_at).map(r=>({...r,person:(data.players||[]).find(p=>p.id===r.player_id)})).filter(x=>x.person);
 const available=roster.filter(x=>availabilityFor(x.player_id,{targetMatch,data,matchData,competition}).status!=='absent');
 const ratings=ratingAverages(data,ownPrior,fixtureWeights,team);
 const coPlay=coPlayMap(ownPrior,data,events,competitions.length?competitions:[competition],fixtureWeights,team);
 const candidates=[];
 for(const formation of formationModules){
  const scores=playerScores(available,ownPrior,sample,data.priorSelections||[],formation,fixtureWeights,data,team,ratings);
  const targets=roleTargets(formation),positions=prematchPositions(formation),used=new Set(),players=[];
  let totalChoice=0,fitSum=0,configuredCount=0,unfilled=0,uncovered=0,movementSum=0;
  for(let i=0;i<positions.length;i++){
   const slotPosition=positions[i],slot=slotPosition.slot,targetRole=targets[i]||'C';
   const picked=bestForSlot(available,used,slot,targetRole,scores,coPlay,rotationOpportunity,slotPosition,data);
   if(!picked){unfilled++;continue}
   used.add(key(picked.player_id));totalChoice+=picked.selectionScore;
   const positionAdjustment=positionalAdjustment(picked.player_id,slotPosition,targetRole,data);
   movementSum+=positionAdjustment.movement;
   const affinity=roleFitForSlot(picked.player_id,slotPosition,targetRole,data);
   if(affinity){
    configuredCount++;fitSum+=affinity.fit;
    if(affinity.fit===0)uncovered++;
   }else fitSum+=roleOf(picked.person)===targetRole?.68:.1;
   const habitual=(data.habitual||[]).find(h=>h.player_id===picked.player_id)?.shirt_number;
   players.push({
    player_id:picked.player_id,slot,role:affinity?.roleCode||roleOf(picked.person)||targetRole,
    name:matchPlayerLabel(picked.person),shirt_number:scores.shirts.get(key(picked.player_id))||habitual||'',
    x:clamp(slotPosition.x,10,90),y:clamp(slotPosition.y,14,86),
    targetRole,positionAdjustment
   });
  }
  const xiIds=new Set(players.map(p=>key(p.player_id)));
  for(const player of players){
   const mean=scores.metrics.get(key(player.player_id))?.meanRating;
   const form=recentOpponentForm(player.player_id,data,ownPrior,fixtureWeights,mean);
   Object.assign(player,expectedRatingFor(player.player_id,xiIds,scores,coPlay,player.positionAdjustment,form),{recentFormDelta:form.delta,formSamples:form.samples});
  }
  const rated=players.filter(p=>finite(p.expectedRating));
  const xiExpectedRating=rated.length?rated.reduce((sum,p)=>sum+Number(p.expectedRating),0)/rated.length:null;
  const tacticalHistory=history.get(formation);
  // A complete, role-compatible XI takes precedence over habitual modules when
  // injuries/absences make the latter unsuitable. Prior coach preference is a
  // bounded bonus, not an unconditional formation lock.
  const score=(players.length?totalChoice/players.length:0)
   +(tacticalHistory?.preference||0)*1.8
   +(fitSum/11)*2.3
   -unfilled*5-uncovered*3-movementSum*.95
   -(formation===preferredFormation?0:.2);
  candidates.push({
   formation,players,xiExpectedRating,availableCount:available.length,sampleSize:sample.length,rotationOpportunity,
   comparableUsed:Boolean(comparableIds.size&&sample.some(m=>comparableIds.has(key(m.fixture_id)))),
   kit:kit||{},confidence:clamp((sample.length/3)*.55+(players.length/11)*.3+(rated.length/11)*.15),
   tacticalScore:score,roleCoverage:players.length?fitSum/players.length:0,
   configuredCount,uncovered,unfilled,movementSum,formationObserved:tacticalHistory?.observations||0,
   changedForAvailability:formation!==preferredFormation,
   reason:formation===preferredFormation?'Modulo storico prevalente':'Modulo alternativo in base a ruoli e disponibilità'
  });
 }
 candidates.sort((a,b)=>b.tacticalScore-a.tacticalScore||b.roleCoverage-a.roleCoverage||a.formation.localeCompare(b.formation));
 // Avoid duplicating the same XI in three nearly identical arrangements where
 // possible, but always preserve the three best distinct modules if available.
 const shortlist=candidates.filter(c=>c.players.length>=Math.min(11,available.length));
 const chosen=(shortlist.length>=3?shortlist:candidates).slice(0,3);
 const main=chosen[0];if(!main)return null;
 return {...main,proposals:chosen.map((p,i)=>({...p,rank:i+1,reason:i===0?'Proposta principale: equilibrio tra disponibilità, precedenti e affinità':p.reason})),
  historicalFormation:preferredFormation,modulesEvaluated:candidates.length};

}

const rating=v=>finite(v)?Number(v).toLocaleString('it-IT',{minimumFractionDigits:1,maximumFractionDigits:1}):'—';
function proposalMarkup(model,escape){
 const nodes=model.players.map((p,i)=>
  '<div class="prematch-lineup-player" style="left:'+p.x+'%;top:'+p.y+'%" title="'+escape(p.name)+' · atteso '+rating(p.expectedRating)+' · media '+rating(p.meanRating)+'">'+
   '<span class="prematch-lineup-shirt">'+shirtSvg(model.kit,'prematch-'+i,false,p.shirt_number||null)+'</span>'+
   '<strong>'+escape(p.name)+'</strong>'+
   '<span class="prematch-player-rating"><b>'+rating(p.expectedRating)+'</b><small>att</small><i>·</i><b>'+rating(p.meanRating)+'</b><small>med</small></span></div>').join('');
 return '<article class="prematch-lineup-slide" data-prematch-slide="'+model.rank+'" tabindex="0" aria-label="Proposta '+model.rank+': modulo '+escape(model.formation)+'">'+
  '<div class="prematch-lineup-head"><div><span class="eyebrow">'+(model.rank===1?'PROPOSTA PRINCIPALE':'ALTERNATIVA '+(model.rank-1))+'</span><h3>'+escape(model.formation)+'</h3></div>'+
  '<span class="prematch-lineup-confidence">'+Math.round(model.confidence*100)+'% base dati</span></div>'+
  (finite(model.xiExpectedRating)?'<div class="prematch-xi-rating"><span>Voto XI atteso</span><strong>'+rating(model.xiExpectedRating)+'</strong></div>':'')+
  '<div class="prematch-lineup-field visual-field"><span class="field-circle"></span><span class="field-midline"></span>'+nodes+'</div>'+
  '<p class="prematch-lineup-note">'+escape(model.reason||'')+'. '+(model.changedForAvailability?'Modulo diverso dal riferimento storico ('+escape(model.historicalFormation||'')+'). ':'')+
  'Ridotti gli spostamenti rispetto ai ruoli naturali; le valutazioni attese includono forma recente ponderata per avversaria e penalità fuori ruolo. '+model.availableCount+' disponibili.</p></article>';
}
export function renderHypotheticalLineup(model,escape=value=>String(value??'')){
 if(!model)return '<div class="prematch-lineup-empty">Formazione ipotetica non disponibile.</div>';
 const proposals=(model.proposals?.length?model.proposals:[model]).map((p,i)=>({...p,rank:i+1,historicalFormation:model.historicalFormation}));
 return '<div class="prematch-lineup-carousel-head"><span>Tre proposte di formazione</span><span>Scorri per confrontarle</span></div>'+
  '<div class="prematch-lineup-carousel" data-prematch-lineup-carousel aria-label="Proposte di formazione, scorrimento orizzontale">'+
  proposals.map(p=>proposalMarkup(p,escape)).join('')+'</div>'+
  '<div class="prematch-lineup-carousel-nav"><button type="button" data-prematch-slide-step="-1" aria-label="Formazione precedente" disabled>‹</button>'+
  '<span data-prematch-slide-index>1 / '+proposals.length+'</span>'+
  '<button type="button" data-prematch-slide-step="1" aria-label="Formazione successiva"'+(proposals.length<=1?' disabled':'')+'>›</button></div>';
}
