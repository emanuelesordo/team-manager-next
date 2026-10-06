import {pitchPositions,formationModules} from './lineup-pitch.js';
import {shirtSvg} from './kit-editor.js';
import {availabilityDefault} from './availability.js';
import {matchPlayerLabel} from './match-player-label.js';
import {cumulativeEventMinute} from './match-minutes.js';

const key=v=>String(v??'');
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const roleOf=p=>String(p?.generic_role_manual||p?.role||'').toUpperCase();
const dateOnly=v=>String(v||'').slice(0,10);
const finite=v=>Number.isFinite(Number(v));

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
function roleTargets(formation){
 const nums=String(formation||'4-4-2').split('-').map(Number);
 const out=['P'];
 nums.forEach((count,index)=>{
  const role=index===0?'D':index===nums.length-1?'A':'C';
  for(let i=0;i<count;i++)out.push(role);
 });
 return out;
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
 const result=new Map();
 for(const p of data.players||[]){
  const row=byPlayer.get(key(p.id)),stat=seasonStats.get(key(p.id));
  const fallback=finite(stat?.avg_rating)?Number(stat.avg_rating):null;
  const mean=row?.plainN?row.plainSum/row.plainN:fallback;
  const context=row?.weight?row.weightedSum/row.weight:fallback;
  result.set(key(p.id),{mean,context,votes:row?.plainN||0});
 }
 return result;
}
function pairKey(a,b){return [key(a),key(b)].sort().join('|')}
function matchDuration(match,competitions){
 const c=(competitions||[]).find(x=>key(x.id)===key(match?.competition_id))||{};
 const periods=Math.max(1,Number(match?.periods_override||c.periods||2));
 const half=Math.max(1,Number(match?.minutes_per_period_override||c.minutes_per_period||40));
 return periods*half;
}
function matchEvents(match,events){
 return (events||[]).filter(e=>key(e.match_id)===key(match.id)&&e.validation_status!=='rejected');
}
function addPairExposure(map,field,minutes,quality,relevance){
 if(minutes<=0||field.size<2)return;
 const ids=[...field];
 for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
  const k=pairKey(ids[i],ids[j]),row=map.get(k)||{minutes:0,quality:0};
  const weighted=minutes*(.6+.8*relevance);
  row.minutes+=weighted;row.quality+=weighted*quality;map.set(k,row);
 }
}
function coPlayMap(matches,data,events,competitions,fixtureWeights,team){
 const selections=data.priorSelections||[],pairs=new Map();
 for(const m of matches){
  const own=selections.filter(s=>key(s.match_id)===key(m.id));
  const starters=new Set(own.filter(s=>s.started||s.selection_status==='starter').map(s=>key(s.player_id)));
  if(!starters.size)continue;
  const quality=resultQuality(m,data,team),relevance=matchRelevance(m,fixtureWeights,data),duration=matchDuration(m,competitions);
  const comp=(competitions||[]).find(x=>key(x.id)===key(m.competition_id))||{};
  const ordered=matchEvents(m,events).filter(e=>e.team_side==='team'&&['substitution','red_card','blue_card','blue_return','temporary_return','return_from_blue'].includes(e.event_type))
   .map((e,i)=>({e,t:cumulativeEventMinute(e,comp),i})).filter(x=>Number.isFinite(x.t))
   .sort((a,b)=>a.t-b.t||String(a.e.created_at||'').localeCompare(String(b.e.created_at||''))||a.i-b.i);
  if(!ordered.length){
   const ids=own.filter(s=>(s.started||s.selection_status==='starter')&&Number(s.minutes_played||duration)>0);
   for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
    const overlap=Math.min(Number(ids[i].minutes_played||duration),Number(ids[j].minutes_played||duration));
    addPairExposure(pairs,new Set([key(ids[i].player_id),key(ids[j].player_id)]),overlap,quality,relevance);
   }
   continue;
  }
  const field=new Set(starters);let cursor=0;
  for(const {e,t} of ordered){
   const at=clamp(Number(t),0,duration),delta=Math.max(0,at-cursor);
   addPairExposure(pairs,field,delta,quality,relevance);cursor=Math.max(cursor,at);
   const pid=e.player_id==null?null:key(e.player_id);
   if(e.event_type==='substitution'){
    if(pid)field.delete(pid);
    if(e.secondary_player_id!=null)field.add(key(e.secondary_player_id));
   }else if(['red_card','blue_card'].includes(e.event_type)){
    if(pid)field.delete(pid);
   }else if(['blue_return','temporary_return','return_from_blue'].includes(e.event_type)&&pid)field.add(pid);
  }
  addPairExposure(pairs,field,Math.max(0,duration-cursor),quality,relevance);
 }
 const score=new Map();
 for(const [k,row] of pairs){
  const raw=row.minutes?row.quality/row.minutes:.5,reliability=clamp(row.minutes/80);
  score.set(k,{score:.5*(1-reliability)+raw*reliability,minutes:row.minutes});
 }
 return score;
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
 const metrics=new Map();
 for(const p of players){
  const r=ratings.get(key(p.player_id))||{},rs=resultScore.get(key(p.player_id));
  metrics.set(key(p.player_id),{
   general:score.get(key(p.player_id))||0,
   meanRating:r.mean??null,contextRating:r.context??r.mean??null,ratingMatches:r.votes||0,
   resultQuality:rs?.w?rs.sum/rs.w:.5
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
function bestForSlot(candidates,used,slot,targetRole,scores,coPlay){
 let best=null,bestScore=-Infinity;
 for(const c of candidates){
  if(used.has(key(c.player_id)))continue;
  const id=key(c.player_id),role=roleOf(c.person),roleFit=role===targetRole?3.2:((targetRole==='C'&&['D','A'].includes(role)) ? .35 : 0);
  const slotFit=scores.slotScore.get(id+'|'+slot)||0,general=scores.score.get(id)||0,m=scores.metrics.get(id)||{};
  const rating=finite(m.contextRating)?(Number(m.contextRating)-6)*1.15:0;
  const result=(Number(m.resultQuality||.5)-.5)*1.6;
  const synergy=(synergyWithUsed(id,used,coPlay)-.5)*2.2;
  const value=slotFit+general+roleFit+rating+result+synergy+(slot===1&&role==='P'?8:0)-(slot===1&&role!=='P'?8:0);
  if(value>bestScore){best=c;bestScore=value}
 }
 return best;
}
function expectedRatingFor(playerId,xiIds,scores,coPlay){
 const m=scores.metrics.get(key(playerId))||{},mean=finite(m.meanRating)?Number(m.meanRating):null,context=finite(m.contextRating)?Number(m.contextRating):mean;
 if(mean==null&&context==null)return {mean:null,expected:null,matches:0};
 const others=new Set([...xiIds].filter(id=>id!==key(playerId))),synergy=synergyWithUsed(playerId,others,coPlay);
 let expected=context??mean;
 if(mean!=null&&context!=null)expected=.55*mean+.45*context;
 expected+=clamp((synergy-.5)*.55,-.28,.28)+clamp((Number(m.resultQuality||.5)-.5)*.22,-.11,.11);
 return {mean:mean??context,expected:clamp(expected,1,10),matches:m.ratingMatches||0,synergy};
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
 const formation=modalFormation(sample.length?sample:ownPrior,fixtureWeights,data,team);
 const roster=eligibleRoster(data,fixture.kickoff_at).map(r=>({...r,person:(data.players||[]).find(p=>p.id===r.player_id)})).filter(x=>x.person);
 const available=roster.filter(x=>availabilityFor(x.player_id,{targetMatch,data,matchData,competition}).status!=='absent');
 const ratings=ratingAverages(data,ownPrior,fixtureWeights,team);
 const scores=playerScores(available,ownPrior,sample,data.priorSelections||[],formation,fixtureWeights,data,team,ratings);
 const coPlay=coPlayMap(ownPrior,data,events,competitions.length?competitions:[competition],fixtureWeights,team);
 const targets=roleTargets(formation),positions=pitchPositions(formation),used=new Set(),players=[];
 for(let i=0;i<positions.length;i++){
  const slot=positions[i].slot,targetRole=targets[i]||'C';
  const picked=bestForSlot(available,used,slot,targetRole,scores,coPlay);if(!picked)continue;
  used.add(key(picked.player_id));
  const habitual=(data.habitual||[]).find(h=>h.player_id===picked.player_id)?.shirt_number;
  players.push({
   player_id:picked.player_id,slot,role:roleOf(picked.person)||targetRole,
   name:matchPlayerLabel(picked.person),shirt_number:scores.shirts.get(key(picked.player_id))||habitual||'',
   x:positions[i].x,y:positions[i].y
  });
 }
 const xiIds=new Set(players.map(p=>key(p.player_id)));
 for(const player of players)Object.assign(player,expectedRatingFor(player.player_id,xiIds,scores,coPlay));
 const rated=players.filter(p=>finite(p.expectedRating));
 const xiExpectedRating=rated.length?rated.reduce((s,p)=>s+Number(p.expectedRating),0)/rated.length:null;
 return {
  formation,players,availableCount:available.length,sampleSize:sample.length,
  comparableUsed:Boolean(comparableIds.size&&sample.some(m=>comparableIds.has(key(m.fixture_id)))),
  kit:kit||{},confidence:clamp((sample.length/3)*.55+(players.length/11)*.3+(rated.length/11)*.15),
  xiExpectedRating
 };
}

const rating=v=>finite(v)?Number(v).toLocaleString('it-IT',{minimumFractionDigits:1,maximumFractionDigits:1}):'—';
export function renderHypotheticalLineup(model,escape=value=>String(value??'')){
 if(!model)return '<div class="prematch-lineup-empty">Formazione ipotetica non disponibile.</div>';
 const nodes=model.players.map((p,i)=>
  '<div class="prematch-lineup-player" style="left:'+p.x+'%;top:'+p.y+'%" title="'+escape(p.name)+' · atteso '+rating(p.expectedRating)+' · media '+rating(p.meanRating)+'">'+
   '<span class="prematch-lineup-shirt">'+shirtSvg(model.kit,'prematch-'+i,false,p.shirt_number||null)+'</span>'+
   '<strong>'+escape(p.name)+'</strong>'+
   '<span class="prematch-player-rating"><b>'+rating(p.expectedRating)+'</b><small>att. · '+rating(p.meanRating)+' media</small></span></div>').join('');
 return '<div class="prematch-lineup-head"><div><span class="eyebrow">FORMAZIONE IPOTETICA</span><h3>'+escape(model.formation)+'</h3></div>'+
  '<span class="prematch-lineup-confidence">'+Math.round(model.confidence*100)+'% base dati</span></div>'+
  (finite(model.xiExpectedRating)?'<div class="prematch-xi-rating"><span>Voto XI atteso</span><strong>'+rating(model.xiExpectedRating)+'</strong></div>':'')+
  '<div class="prematch-lineup-field visual-field"><span class="field-circle"></span><span class="field-midline"></span>'+nodes+'</div>'+
  '<p class="prematch-lineup-note">'+
   (model.comparableUsed?'Ponderate soprattutto '+model.sampleSize+' formazion'+(model.sampleSize===1?'e':'i')+' contro avversarie di potenziale comparabile.':'Campione comparabile ridotto: integrate le formazioni recenti.')+
   ' La scelta combina disponibilità, ruolo/slot, voti, risultati e rendimento delle coppie di giocatori realmente contemporanee in campo. Considerati '+model.availableCount+' disponibili.</p>';
}
