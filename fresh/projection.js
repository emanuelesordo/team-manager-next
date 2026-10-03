/**
 * Deterministic Monte Carlo season projection (10,000 simulations).
 * Official source: app_competition_fixtures + app_competition_standings;
 * NEVER persisted. Tied final points share the same indicative rank.
 * Formula: season 30%, recency 25%, goal difference 20%, attack 10%,
 * defense 10%, venue form 5%, all normalized to [0,1].
 */
const clamp=(x,low=0,hi=1)=>Math.max(low,Math.min(hi,x));
const done=f=>f?.status==='finished'&&Number.isInteger(f.home_score)&&Number.isInteger(f.away_score);
const identity=(teamId,opponentId)=>teamId?'team:'+teamId:opponentId?'opponent:'+opponentId:null;
const homeId=f=>identity(f.home_team_id,f.home_opponent_id);
const awayId=f=>identity(f.away_team_id,f.away_opponent_id);
const standingId=s=>identity(s.team_id,s.opponent_id);
const score=(f,who)=>homeId(f)===who?
 [f.home_score,f.away_score]:[f.away_score,f.home_score];
const points=(g,a,c)=>g>a?Number(c.win_points??3):g<a?Number(c.loss_points??0):Number(c.draw_points??1);
const KEY_LIMIT=6;
const memo=new Map();
function hash(str){let v=2166136261>>>0;for(let i=0;i<str.length;i++){v^=str.charCodeAt(i);v=Math.imul(v,16777619)}return v||1234567}
function random(seed){let x=seed>>>0||1;return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296}}
function poisson(lambda,rand){const lim=Math.exp(-lambda);let k=0,p=1;do{k++;p*=Math.max(rand(),1e-12)}while(p>lim&&k<19);return k-1}
function validTeams(fixtures,standings){return [...new Set([...fixtures.flatMap(x=>[homeId(x),awayId(x)]),...standings.map(standingId)])].filter(Boolean).sort()}
function weights(rows,c,venue=null){
 if(!rows.length)return .5;
 let n=0,d=0;for(let i=0;i<rows.length;i++){const row=rows[i],w=i+1;
  if(venue&&homeId(row)!==venue.team&&awayId(row)!==venue.team)continue;
  if(venue&&(homeId(row)===venue.team?'home':'away')!==venue.side)continue;
  const [g,a]=score(row,venue?.team||c.team);
  n+=w*(points(g,a,c)/Math.max(1,Number(c.win_points??3)));d+=w}
 return d?clamp(n/d):.5;
}
function strengths(teams,completed,config){
 const allGoals=completed.reduce((s,f)=>s+f.home_score+f.away_score,0);
 const avgGoal=completed.length?clamp(allGoals/(completed.length*2),.6,2.2):1.3;
 const scores=new Map();
 for(const team of teams){
  const played=completed.filter(f=>homeId(f)===team||awayId(f)===team).sort((a,b)=>new Date(a.kickoff_at)-new Date(b.kickoff_at));
  let gf=0,ga=0,total=0,home=[],away=[];
  for(const f of played){const [g,a]=score(f,team);gf+=g;ga+=a;total+=points(g,a,config);(homeId(f)===team?home:away).push(f)}
  const n=played.length,ppg=n?total/(n*Math.max(1,Number(config.win_points??3))):.5;
  const last=played.slice(-5);
  const recent=weights(last,{...config,team});
  const goalDiff=n?clamp(.5+(gf-ga)/(n*5)):.5;
  const attack=n?clamp(gf/n/3):.5;
  const defense=n?1-clamp(ga/n/3):.5;
  const homeAway=(weights(home.slice(-5),{...config,team},{team,side:'home'})+
   weights(away.slice(-5),{...config,team},{team,side:'away'}))/2;
  const raw=.3*ppg+.25*recent+.2*goalDiff+.1*attack+.1*defense+.05*homeAway;
  const shrink=n/(n+4);
  scores.set(team,{strength:clamp(.5*(1-shrink)+raw*shrink),games:n,gf,ga});
 }
 return {scores,avgGoal};
}
export function projectionSignature(config,fixtures,standings){
 return JSON.stringify([config?.id,config?.win_points,config?.draw_points,config?.loss_points,
  fixtures.filter(f=>f.competition_id===config?.id).map(f=>[f.id,f.kickoff_at,homeId(f),awayId(f),f.status,f.home_score,f.away_score]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))),
  standings.filter(s=>s.competition_id===config?.id).map(s=>[standingId(s),s.points,s.played,s.goals_for,s.goals_against]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])))]);
}
export function projectLeague(config,fixtures,standings,iterations=10000){
 if(!config?.id||!Number.isInteger(iterations)||iterations<1||iterations>20000)throw Error('Proiezione: parametri non validi');
 const rows=fixtures.filter(f=>f.competition_id===config.id&&f.status!=='cancelled');
 const table=standings.filter(s=>s.competition_id===config.id);
 if(!rows.length||!table.length)return null;
 const teams=validTeams(rows,table);if(teams.length<2)return null;
 const completed=rows.filter(done),remaining=rows.filter(f=>!done(f)&&['scheduled','postponed'].includes(f.status));
 if(!remaining.length)return {complete:true,iterations:0,teams:teams.map(t=>({team:table.find(row=>standingId(row)===t)?.team||t,club_id:t})),played:completed.length,remaining:0};
 const signature=projectionSignature(config,rows,table);
 const key=signature+'|'+iterations;if(memo.has(key))return memo.get(key);
 const {scores,avgGoal}=strengths(teams,completed,config);
 const n=teams.length,index=new Map(teams.map((t,i)=>[t,i])),rand=random(hash(signature));
 const initialPoints=new Int32Array(n);
 const currentRank=new Map();
 for(let i=0;i<n;i++){
  const r=table.find(x=>standingId(x)===teams[i]);
  initialPoints[i]=Math.round(Number(r?.points??0));
  currentRank.set(teams[i],1+table.filter(x=>Number(x.points??0)>Number(r?.points??0)).length);
 }
 const sumsP=new Float64Array(n),sumsR=new Float64Array(n),ranks=teams.map(()=>[]);
 const pairs=remaining.map(f=>({h:index.get(homeId(f)),a:index.get(awayId(f))}))
  .filter(x=>Number.isInteger(x.h)&&Number.isInteger(x.a)&&x.h!==x.a);
 for(let simulation=0;simulation<iterations;simulation++){
  const p=Int32Array.from(initialPoints);
  for(const {h,a} of pairs){
   const diff=scores.get(teams[h]).strength-scores.get(teams[a]).strength;
   const home=Math.max(.15,Math.min(4.3,avgGoal*1.1*Math.exp(diff*.85)));
   const away=Math.max(.15,Math.min(4.3,avgGoal*.93*Math.exp(-diff*.85)));
   const hg=poisson(home,rand),ag=poisson(away,rand);
   p[h]+=points(hg,ag,config);p[a]+=points(ag,hg,config);
  }
  for(let i=0;i<n;i++){
   sumsP[i]+=p[i];let greater=0;
   for(let j=0;j<n;j++)if(p[j]>p[i])greater++;
   const position=1+greater;
   ranks[i].push(position);sumsR[i]+=position;
  }
 }
 const covered=completed.length/(completed.length+remaining.length);
 const output={
  complete:false,iterations,played:completed.length,remaining:remaining.length,
  reliability:Math.round(100*covered), // data-completeness heuristic, NOT confidence.
  rows:teams.map((team,i)=>{
   const ordered=ranks[i].sort((a,b)=>a-b),q=p=>ordered[Math.floor((ordered.length-1)*p)];
   return{club_id:team,team:table.find(row=>standingId(row)===team)?.team||team,position:sumsR[i]/iterations,expectedPoints:sumsP[i]/iterations,
    lowerPosition:q(.2),upperPosition:q(.8),currentPosition:currentRank.get(team),
    existingPoints:initialPoints[i],gamesCompleted:scores.get(team)?.games??0};
  }).sort((a,b)=>a.position-b.position||a.team.localeCompare(b.team,'it'))
 };
 memo.set(key,output);if(memo.size>KEY_LIMIT)memo.delete(memo.keys().next().value);
 return output;
}
