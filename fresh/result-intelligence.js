// Result-only football intelligence. No event dependency and no future-result leakage.
const clamp=(x,lo=0,hi=1)=>Math.max(lo,Math.min(hi,x));
const clubAt=(f,side)=>f?.[side+'_team_id']?'team:'+f[side+'_team_id']:f?.[side+'_opponent_id']?'opponent:'+f[side+'_opponent_id']:null;
const valid=f=>f?.status==='finished'&&f.is_test!==true&&f.home_score!=null&&f.away_score!=null&&Number.isInteger(Number(f.home_score))&&Number.isInteger(Number(f.away_score));
const points=(gf,ga,config)=>gf>ga?Number(config?.win_points??3):gf===ga?Number(config?.draw_points??1):Number(config?.loss_points??0);
const mean=a=>a.length?a.reduce((v,x)=>v+x,0)/a.length:null;
const median=a=>{if(!a.length)return null;const v=[...a].sort((x,y)=>x-y);return v.length%2?v[(v.length-1)/2]:(v[v.length/2-1]+v[v.length/2])/2};
const std=a=>{if(a.length<2)return null;const m=mean(a);return Math.sqrt(a.reduce((sum,x)=>sum+(x-m)**2,0)/a.length)};
const norm=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'');
const safeDate=x=>{const n=Date.parse(x??'');return Number.isFinite(n)?n:null};
const status=(gf,ga)=>gf>ga?'W':gf===ga?'D':'L';
const winFraction=result=>result==='W'?1:result==='D'?.5:0;
const emptyGroup=()=>({matches:0,points:0,gf:0,ga:0,wins:0,draws:0,losses:0,ppg:null,gfpg:null,gapg:null,gdpg:null});
const addGroup=(group,r)=>{group.matches++;group.points+=r.points;group.gf+=r.gf;group.ga+=r.ga;group[r.result==='W'?'wins':r.result==='D'?'draws':'losses']++;};
const finishGroup=group=>({...group,ppg:group.matches?group.points/group.matches:null,gfpg:group.matches?group.gf/group.matches:null,gapg:group.matches?group.ga/group.matches:null,gdpg:group.matches?(group.gf-group.ga)/group.matches:null});

export function analyseResults(fixtures=[],club,{competitions=[],venues=[],history=[],predictionSnapshots=[],before=null}={}){
 const cutoff=before==null?null:safeDate(before);
 const played=(fixtures||[]).filter(valid).filter(f=>cutoff===null||(safeDate(f.kickoff_at)!=null&&safeDate(f.kickoff_at)<cutoff))
  .sort((a,b)=>(safeDate(a.kickoff_at)??0)-(safeDate(b.kickoff_at)??0)||String(a.id).localeCompare(String(b.id)));
 const competitionMap=new Map(competitions.map(c=>[String(c.id),c]));
 const ratings=new Map(),appearances=new Map(),own=[],all=[];
 const ratingKey=(f,id)=>String(f.competition_id??'all')+'|'+id;
 const prior=(f,id)=>{
  const kickoff=safeDate(f.kickoff_at);
  if(kickoff===null)return null;
  const date=new Date(kickoff);
  const year=date.getUTCFullYear()-(date.getUTCMonth()<6?1:0);
  const previous=history.filter(h=>(h.team_id?'team:'+h.team_id:h.opponent_id?'opponent:'+h.opponent_id:null)===id&&
   Number(h.season_start_year)<year).sort((a,b)=>Number(b.season_start_year)-Number(a.season_start_year))[0];
  if(!previous)return null;
  const tier=Math.max(1,Number(previous.tier_level)||3);
  const n=Number(previous.total_positions),position=Number(previous.final_position);
  const placement=Number.isFinite(n)&&n>=2&&Number.isFinite(position)?clamp((n-position)/(n-1)):.5;
  const pointsShare=Number(previous.max_points)>0?clamp(Number(previous.points||0)/Number(previous.max_points)):.5;
  return Math.max(1300,Math.min(1670,1500+(2-tier)*65+(placement-.5)*50+(pointsShare-.5)*60));
 };
 for(const f of played){
  const home=clubAt(f,'home'),away=clubAt(f,'away');
  if(!home||!away||home===away)continue;
  const ck=ratingKey(f,home),ak=ratingKey(f,away);
  const homePrior=prior(f,home),awayPrior=prior(f,away);
  const rh=ratings.get(ck)??homePrior??1500,ra=ratings.get(ak)??awayPrior??1500;
  const nh=appearances.get(ck)||0,na=appearances.get(ak)||0;
  const eh=1/(1+Math.pow(10,(ra-rh-45)/400)),ea=1-eh;
  const homeGoals=Number(f.home_score),awayGoals=Number(f.away_score);
  const resultHome=homeGoals>awayGoals?1:homeGoals===awayGoals?.5:0;
  const factor=Math.min(1.5,1+Math.abs(homeGoals-awayGoals)*.1);
  const shift=24*(resultHome-eh)*factor;
  ratings.set(ck,rh+shift);ratings.set(ak,ra-shift);
  appearances.set(ck,nh+1);appearances.set(ak,na+1);
  if(home!==club&&away!==club)continue;
  const atHome=home===club,ourRating=atHome?rh:ra,oppRating=atHome?ra:rh;
  const ownAppearances=atHome?nh:na,oppAppearances=atHome?na:nh;
  const gf=atHome?homeGoals:awayGoals,ga=atHome?awayGoals:homeGoals;
  const result=status(gf,ga),config=competitionMap.get(String(f.competition_id));
  const expectation=atHome?eh:ea;
  const ownKnown=ownAppearances>=2||(atHome?homePrior:awayPrior)!=null;
  const opponentKnown=oppAppearances>=2||(atHome?awayPrior:homePrior)!=null;
  const bucket=ownKnown&&opponentKnown?(oppRating-ourRating>60?'higher':oppRating-ourRating< -60?'lower':'similar'):'unknown';
  const r={
   fixture_id:f.id,kickoff_at:f.kickoff_at,competition_id:f.competition_id,
   opponent:atHome?away:home,venue:f.venue_name||f.venue||null,
   atHome,gf,ga,margin:gf-ga,result,points:points(gf,ga,config),
   ratingBefore:ourRating,ratingAfter:atHome?rh+shift:ra-shift,
   opponentRatingBefore:oppRating,opponentTier:bucket,expectedOutcome:expectation,
   opponentSample:oppAppearances,ownSample:ownAppearances,rankReliable:ownKnown&&opponentKnown
  };
  own.push(r);
  all.push({fixture:f,row:r});
 }
 const n=own.length, gf=own.map(r=>r.gf),ga=own.map(r=>r.ga);
 const totals=own.map(r=>r.gf+r.ga),margins=own.map(r=>r.margin);
 const count=pred=>own.filter(pred).length;
 const rate=countValue=>n?countValue/n:null;
 const home=emptyGroup(),away=emptyGroup(),rank={higher:emptyGroup(),similar:emptyGroup(),lower:emptyGroup(),unknown:emptyGroup()};
 for(const r of own){addGroup(r.atHome?home:away,r);addGroup(rank[r.opponentTier],r);}
 const scorelines=new Map();
 for(const r of own){const key=r.gf+'–'+r.ga;scorelines.set(key,(scorelines.get(key)||0)+1);}
 const scorelineFrequency=[...scorelines].map(([score,count])=>({score,count,rate:rate(count)})).sort((a,b)=>b.count-a.count||a.score.localeCompare(b.score,'it'));
 const marginsByResult={
  win1:count(r=>r.margin===1),win2:count(r=>r.margin===2),win3plus:count(r=>r.margin>=3),
  loss1:count(r=>r.margin===-1),loss2:count(r=>r.margin===-2),loss3plus:count(r=>r.margin<=-3),
  draw:count(r=>r.margin===0)
 };
 const lastFive=own.slice(-5),formRaw=lastFive.length?lastFive.reduce((acc,r,i)=>acc+(i+1)*winFraction(r.result),0)/lastFive.reduce((acc,_,i)=>acc+i+1,0):null;
 const qualified=lastFive.filter(r=>r.rankReliable);
 const adjusted=qualified.length>=2?lastFive.reduce((acc,r,i)=>{
  const observed=winFraction(r.result),expected=r.rankReliable?r.expectedOutcome:.5;
  return acc+(i+1)*clamp(.5+observed-expected);
 },0)/lastFive.reduce((acc,_,i)=>acc+i+1,0):null;
 const venueIndex=new Map(venues.map(v=>[norm(v.name),v]));
 const venuesByName=new Map(),bySurface=new Map(),byWidth=new Map(),byLength=new Map();
 const record=(map,key,r)=>{if(!key)return;const g=map.get(String(key))||emptyGroup();addGroup(g,r);map.set(String(key),g)};
 for(const r of own){
  record(venuesByName,r.venue,r);
  const v=venueIndex.get(norm(r.venue));
  if(!v)continue;
  record(bySurface,v.surface_type,r);record(byWidth,v.width_profile,r);record(byLength,v.length_profile,r);
 }
 const listGroups=map=>[...map].map(([label,g])=>({label,...finishGroup(g)})).sort((a,b)=>b.matches-a.matches||a.label.localeCompare(b.label));
 const trend=own.map(r=>({fixture_id:r.fixture_id,date:r.kickoff_at,rating:Math.round(r.ratingAfter),change:Number((r.ratingAfter-r.ratingBefore).toFixed(1)),result:r.result}));
 const snapshots=new Map(predictionSnapshots.filter(x=>x.fixture_id!=null).map(x=>[String(x.fixture_id),x]));
 let actualPoints=0,expectedPoints=0,snapshotCount=0;
 for(const {fixture,row:r} of all){
  const s=snapshots.get(String(fixture.id));if(!s)continue;
  const recorded=s.generated_at||s.created_at;
  if(!recorded||safeDate(recorded)==null||safeDate(fixture.kickoff_at)==null||safeDate(recorded)>=safeDate(fixture.kickoff_at))continue;
  const ph=Number(s.home_probability??s.prob_home),pd=Number(s.draw_probability??s.prob_draw),pa=Number(s.away_probability??s.prob_away);
  if(![ph,pd,pa].every(Number.isFinite)||Math.abs(ph+pd+pa-1)>.02)continue;
  const c=competitionMap.get(String(fixture.competition_id)),w=Number(c?.win_points??3),d=Number(c?.draw_points??1),l=Number(c?.loss_points??0);
  expectedPoints+=(r.atHome?ph:pa)*w+pd*d+(r.atHome?pa:ph)*l;
  actualPoints+=r.points;snapshotCount++;
 }
 return {
  played:n,
  scorelines:scorelineFrequency,
  margins:marginsByResult,
  marginStats:{
   mean:mean(margins),median:median(margins),winning:mean(margins.filter(x=>x>0)),
   losing:mean(margins.filter(x=>x<0).map(Math.abs)),goalsForStd:std(gf),goalsAgainstStd:std(ga),marginStd:std(margins)
  },
  bothScore:{count:count(r=>r.gf>0&&r.ga>0),rate:rate(count(r=>r.gf>0&&r.ga>0))},
  totalGoals:{
   zeroOne:count(r=>r.gf+r.ga<=1),two:count(r=>r.gf+r.ga===2),threePlus:count(r=>r.gf+r.ga>=3),
   zeroOneRate:rate(count(r=>r.gf+r.ga<=1)),twoRate:rate(count(r=>r.gf+r.ga===2)),threePlusRate:rate(count(r=>r.gf+r.ga>=3))
  },
  closeAtFinal:{count:count(r=>Math.abs(r.margin)<=1),rate:rate(count(r=>Math.abs(r.margin)<=1))},
  venue:{home:finishGroup(home),away:finishGroup(away),byName:listGroups(venuesByName),bySurface:listGroups(bySurface),byWidth:listGroups(byWidth),byLength:listGroups(byLength)},
  opponentTier:Object.fromEntries(Object.entries(rank).map(([key,g])=>[key,finishGroup(g)])),
  form:{raw:formRaw,opponentAdjusted:adjusted,sample:lastFive.length,adjustedSample:qualified.length},
  strength:{index:trend.length?trend.at(-1).rating:null,deltaFive:trend.length>=2?trend.at(-1).rating-trend[Math.max(0,trend.length-6)].rating:null,trend,model:'Elo descrittivo, non forza ufficiale'},
  vsPrediction:snapshotCount?{matches:snapshotCount,actualPoints,expectedPoints,delta:actualPoints-expectedPoints}:{matches:0,actualPoints:null,expectedPoints:null,delta:null},
  source:'Risultati finali verificati; forza avversaria stimata da storico antecedente e risultati prima della gara'
 };
}
