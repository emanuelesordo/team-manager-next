import {matchPlayerIntervals,matchElapsedMinute,confirmedMatchEvent} from './player-participation.js?v=20261014periodpriority1';

const K=x=>String(x??'');
const E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;', '"':'&quot;',"'":'&#39;'}[c]));
const GOALS=new Set(['goal','penalty_goal','penalty_scored','own_goal']);
const ACCEPT=e=>confirmedMatchEvent(e)&&e.payload?.count_score!==false;
const number=x=>Number.isFinite(x)?x.toLocaleString('it-IT',{maximumFractionDigits:2}):'—';
const rate=(x,mins,unit)=>mins>0?number(x*unit/mins):'—';
const inRange=(x,ints)=>ints.some(([a,b])=>x>=a&&x<b);
const metric=(title,value,note='')=>'<div class="psi-metric"><span>'+E(title)+'</span><strong>'+E(value)+'</strong><small>'+E(note)+'</small></div>';
const segment=(title,items,note='')=>'<article class="psi-slide"><h3>'+E(title)+'</h3><div class="psi-metrics">'+items.map(x=>metric(...x)).join('')+'</div>'+(note?'<p class="psi-note">'+E(note)+'</p>':'')+'</article>';
function lineChart(values,labels,title){
 if(!values.length)return '<p class="psi-note">Dati insufficienti per il grafico.</p>';
 const nums=values.filter(Number.isFinite);if(!nums.length)return '<p class="psi-note">Nessuna gara con intervalli affidabili.</p>';const lo=Math.min(0,...nums),hi=Math.max(1,...nums),w=560,h=176,p=26;
 const pts=values.map((v,i)=>Number.isFinite(v)?[p+i*(w-2*p)/Math.max(1,values.length-1),h-p-(v-lo)/(hi-lo)*(h-2*p)]:null);
 const groups=[];let run=[];for(const a of pts){if(a)run.push(a);else if(run.length){groups.push(run);run=[]}}if(run.length)groups.push(run);const poly=groups.map(g=>'<polyline points="'+g.map(p=>p.join(',')).join(' ')+'" fill="none" stroke="#55af95" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>').join('');
 return '<div class="psi-line-wrap"><svg class="psi-line" viewBox="0 0 560 176" role="img" aria-label="'+E(title)+'"><path d="M26 150H534M26 25H534" fill="none" stroke="currentColor" opacity=".15"/>'+poly+''+pts.map((a,i)=>a?'<circle cx="'+a[0]+'" cy="'+a[1]+'" r="4" fill="#55af95"><title>'+E(labels[i])+': '+E(number(values[i]))+'</title></circle>':'').join('')+'</svg><div class="psi-axis"><span>'+E(labels[0]||'')+'</span><span>'+E(labels.at(-1)||'')+'</span></div></div>';
}
function donut(values){
 const entries=values.filter(x=>x[1]>0),sum=entries.reduce((n,x)=>n+x[1],0);
 if(!sum)return '<p class="psi-note">Nessun dato disponibile per la distribuzione.</p>';
 let offset=0;
 const colors=['#55af95','#8f99aa','#e5a76a','#c87c88','#749ad0'];
 const gradients=entries.map((x,i)=>{const start=offset;offset+=x[1]/sum*100;return colors[i%colors.length]+' '+start+'% '+offset+'%'}).join(',');
 return '<div class="psi-donut-row"><div class="psi-donut" style="background:conic-gradient('+gradients+')" role="img" aria-label="'+E(entries.map(x=>x[0]+' '+Math.round(x[1]/sum*100)+'%').join(', '))+'"><span>'+number(sum)+'</span></div><div class="psi-legend">'+entries.map((x,i)=>'<div><i style="background:'+colors[i%colors.length]+'"></i><span>'+E(x[0])+'</span><b>'+Math.round(x[1]/sum*100)+'%</b></div>').join('')+'</div></div>';
}
const status=(gf,ga)=>gf>ga?'V':gf<ga?'P':'N';
const points=(gf,ga)=>gf>ga?3:gf===ga?1:0;

/** Uses match-local player intervals; missing or contradictory event timelines yield N/D, never invented on-field goals. */
export function playerIntelligence(playerId,{fixtures=[],matches=[],matchPlayers=[],events=[],competitions=[],team=null,stats={}}={}){
 const byMatch=new Map(), byFixture=new Map(fixtures.map(f=>[K(f.id),f]));
 for(const e of events){if(!ACCEPT(e))continue;const k=K(e.match_id);if(!byMatch.has(k))byMatch.set(k,[]);byMatch.get(k).push(e)}
 const pRows=new Map();
 for(const p of matchPlayers){const k=K(p.match_id);if(!pRows.has(k))pRows.set(k,[]);pRows.get(k).push(p)}
 const total={games:0,starts:0,bench:0,unused:0,minutes:0,minutesKnown:0,goals:0,assists:0,subGoals:0,subAssists:0,firstGoals:0,equalizers:0,leadGoals:0,comeFromBehindGoals:0,goalWins:0,braces:0,hattricks:0,scoredMinutes:[],assistedMinutes:[],gfOn:0,gaOn:0,gfOff:0,gaOff:0,onMinutes:0,offMinutes:0,covered:0,eligible:0,states:{leading:0,drawing:0,trailing:0},results:{W:0,D:0,L:0},starterPoints:0,subPoints:0,entryPointsDelta:0,exitPointsDelta:0,red:0,yellow:0,trend:[],rating:[],matches:[],duration:80,positionGroups:{},goalsByPeriod:[0,0],goalsByContext:[0,0,0],onOffGames:0,fullGames:0,cleanOn:0,entryMinutes:[],exitMinutes:[],home:{games:0,goals:0,assists:0,points:0},away:{games:0,goals:0,assists:0,points:0},teamGoalsDuringAppearances:0};
 for(const m of matches){
  if(m.is_test||m.status!=='finished')continue;
  const f=byFixture.get(K(m.fixture_id));if(!f||f.status!=='finished'||!Number.isInteger(f.home_score)||!Number.isInteger(f.away_score))continue;
  const home=K(f.home_team_id)===K(team?.id),away=K(f.away_team_id)===K(team?.id);
  if(home===away)continue;
  const p=pRows.get(K(m.id))||[], me=p.find(x=>K(x.player_id)===K(playerId));
  if(!me)continue;
  const comp=competitions.find(x=>K(x.id)===K(f.competition_id||m.competition_id))||{};
  const half=Number(m.minutes_per_period_override||comp.minutes_per_period)||40;
  const base=half*(Number(m.periods_override||comp.periods)||2);
  const gameEvents=(byMatch.get(K(m.id))||[]).map(e=>({...e,team_side:e.team_side==='home'?(home?'team':'opponent'):e.team_side==='away'?(away?'team':'opponent'):e.team_side}));
  const timeline=matchPlayerIntervals(m,p,gameEvents,comp);
  const duration=timeline.timing.duration;total.duration=timeline.timing.half*timeline.timing.periods;
  const minute=e=>matchElapsedMinute(e,comp,timeline.timing);
  const participation=timeline.players.get(K(playerId));
  const started=me.started===true;
  const intervals=participation?.intervals||[],bad=!participation?.valid;
  const redEvents=gameEvents.filter(e=>e.team_side==='team'&&K(e.player_id)===K(playerId)&&['red_card','second_yellow'].includes(e.event_type));
  const played=participation?.entered||intervals.some(([a,b])=>b>a);
  const record=started||played;
  if(!record){if(me.selection_status!=='unavailable')total.unused++;continue}
  total.games++;if(started)total.starts++;else total.bench++;
  if(!bad){const mins=intervals.reduce((n,[a,b])=>n+b-a,0);total.minutes+=mins;total.minutesKnown++;total.eligible++;if(started&&intervals.length===1&&intervals[0][0]===0&&intervals[0][1]===duration)total.fullGames++;if(!started&&intervals.length)total.entryMinutes.push(intervals[0][0]);if(intervals.length&&intervals.at(-1)[1]<duration)total.exitMinutes.push(intervals.at(-1)[1]);}
  const gf=home?f.home_score:f.away_score,ga=home?f.away_score:f.home_score;
  total.results[gf>ga?'W':gf<ga?'L':'D']++;
  const location=home?total.home:total.away;location.games++;location.points+=points(gf,ga);total.teamGoalsDuringAppearances+=gf;
  if(started)total.starterPoints+=points(gf,ga);else total.subPoints+=points(gf,ga);
  const orderedGoals=gameEvents.filter(e=>GOALS.has(e.event_type)&&e.payload?.count_score!==false).sort((a,b)=>(minute(a)??Infinity)-(minute(b)??Infinity)||K(a.created_at).localeCompare(K(b.created_at)));
  const goalsGood=orderedGoals.length===gf+ga&&orderedGoals.every(e=>minute(e)!==null&&['team','opponent'].includes(e.team_side));
  const normalized=orderedGoals.map(e=>({...e,scoreSide:e.event_type==='own_goal'?(e.team_side==='team'?'opponent':'team'):e.team_side,t:minute(e)}));
  let gOwn=0,aOwn=0,scoreF=0,scoreA=0;
  for(const e of normalized){
   const beforeF=scoreF,beforeA=scoreA;
   if(e.scoreSide==='team'){
    if(K(e.player_id)===K(playerId)&&e.event_type!=='own_goal'){
     gOwn++;total.goals++;if(!started)total.subGoals++;
     if(e.t!=null){total.scoredMinutes.push(e.t);total.goalsByPeriod[e.payload?.period==='first_half'?0:e.payload?.period==='second_half'?1:e.t<=half?0:1]++}
     if(beforeF===0&&beforeA===0)total.firstGoals++;
     if(beforeF<beforeA&&beforeF+1===beforeA)total.equalizers++;
     if(beforeF===beforeA)total.leadGoals++;
     if(beforeF<beforeA)total.comeFromBehindGoals++;
     total.goalsByContext[beforeF>beforeA?0:beforeF===beforeA?1:2]++;
    }
    if(K(e.secondary_player_id)===K(playerId)&&K(e.player_id)!==K(playerId)){aOwn++;total.assists++;if(!started)total.subAssists++;if(e.t!=null)total.assistedMinutes.push(e.t)}
    scoreF++;
   }else if(e.scoreSide==='opponent')scoreA++;
  }
  location.goals+=gOwn;location.assists+=aOwn;
  if(gOwn>=2)total.braces++;if(gOwn>=3)total.hattricks++;
  total.yellow+=gameEvents.filter(e=>e.event_type==='yellow_card'&&e.team_side==='team'&&K(e.player_id)===K(playerId)).length;
  total.red+=redEvents.length;
  const game={match_id:K(m.id),label:new Date(f.kickoff_at||m.kickoff_at).toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit'}),gf,ga,minutes:bad?null:intervals.reduce((n,[a,b])=>n+b-a,0),goals:gOwn,assists:aOwn,pm:null,rating:null,quality:goalsGood&&!bad?'verificata':'parziale'};
  // Reconcile full score, otherwise plus/minus and state times remain N/D.
  if(goalsGood&&!bad&&normalized.filter(x=>x.scoreSide==='team').length===gf&&normalized.filter(x=>x.scoreSide==='opponent').length===ga){
   let localGF=0,localGA=0,last=0,curF=0,curA=0;
   const boundaries=[...new Set([0,duration,...intervals.flat(),...normalized.map(x=>x.t)])].sort((a,b)=>a-b);
   for(let i=0;i<boundaries.length-1;i++){
    const a=boundaries[i],b=boundaries[i+1],mid=(a+b)/2;
    const before=normalized.filter(x=>x.t<=a);
    curF=before.filter(x=>x.scoreSide==='team').length;curA=before.length-curF;
    if(inRange(mid,intervals))total.states[curF>curA?'leading':curF<curA?'trailing':'drawing']+=b-a;
   }
   for(const e of normalized){const instant=Math.min(duration-0.00001,e.t+0.00001);if(inRange(instant,intervals)){if(e.scoreSide==='team')localGF++;else localGA++}}
   const on=game.minutes;
   total.covered++;total.gfOn+=localGF;total.gaOn+=localGA;if(localGA===0)total.cleanOn++;
   total.gfOff+=gf-localGF;total.gaOff+=ga-localGA;
   total.onMinutes+=on;total.offMinutes+=duration-on;
   game.pm=localGF-localGA;
   total.onOffGames++;
   const entry=intervals[0]?.[0]??0,exit=intervals.at(-1)?.[1]??duration;
   const beforeEntry=normalized.filter(x=>x.t<entry);
   const beforeExit=normalized.filter(x=>x.t<=exit);
   const pAt=arr=>points(arr.filter(x=>x.scoreSide==='team').length,arr.filter(x=>x.scoreSide==='opponent').length);
   if(!started)total.entryPointsDelta+=points(gf,ga)-pAt(beforeEntry);
   if(exit<duration)total.exitPointsDelta+=points(gf,ga)-pAt(beforeExit);
   // Goal that makes the final lead and remains unanswered by opponent.
   let ownScoreF=0,ownScoreA=0;
   normalized.forEach((e,i)=>{if(e.scoreSide==='team')ownScoreF++;else ownScoreA++;
    if(e.scoreSide==='team'&&K(e.player_id)===K(playerId)&&gf>ga&&ownScoreF===ga+1&&ownScoreF>ownScoreA)total.goalWins++;
   });
  }
  total.matches.push(game);
 }
 total.trend=total.matches.map((x,i)=>({label:x.label,value:total.matches.slice(0,i+1).every(m=>m.pm!==null)?total.matches.slice(0,i+1).reduce((n,m)=>n+m.pm,0):null,verified:x.pm!==null}));
 return total;
}

function vizBar(label,value,max,kind='a',suffix=''){
 const valid=value!=null&&Number.isFinite(Number(value))&&max>0;
 const fraction=valid?Math.max(0,Math.min(100,Number(value)/max*100)):0;
 return '<div class="psi-vizbar" data-kind="'+kind+'" title="'+E(label)+': '+(valid?E(number(Number(value))+suffix):'N/D')+'"><div class="psi-vizbar-head"><span>'+E(label)+'</span><b>'+ (valid?E(number(Number(value))+suffix):'—')+'</b></div><div class="psi-vizbar-track"><i style="--viz-width:'+fraction.toFixed(2)+'%"></i></div></div>';
}
function vizMatchMinutes(ordered,minuteMap,ready,maxPeriod=80){
 if(!ready)return '<p class="psi-note">Minuti delle singole gare non verificati.</p>';
 const list=ordered.filter(m=>minuteMap.has(K(m.id)));
 if(!list.length)return '<p class="psi-note">Nessuna partita disputata.</p>';
 const top=Math.max(maxPeriod,...list.map(m=>minuteMap.get(K(m.id))||0));
 return '<div class="psi-match-bars" aria-label="Minuti per partita">'+list.map(m=>{
  const value=minuteMap.get(K(m.id));
  const pct=value==null?0:Math.max(0,Math.min(100,value/top*100));
  const label=new Date(m.kickoff_at).toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit'});
  return '<div class="psi-match-bar" tabindex="0" title="'+E(label)+' · '+E(value)+' minuti"><div class="psi-match-value">'+E(value)+'′</div><div class="psi-match-column"><i style="--viz-height:'+pct.toFixed(2)+'%"></i></div><div class="psi-match-label">'+E(label)+'</div></div>';
 }).join('')+'</div>';
}
function vizImpact(gf,ga,pm,valid){
 if(!valid||gf==null||ga==null)return '<p class="psi-note">Impatto non completamente verificato.</p>';
 const total=gf+ga,win=total?gf/total*100:50,loss=total?ga/total*100:50;
 return '<div class="psi-scoreviz" role="img" aria-label="'+E('Gol fatti '+gf+', subiti '+ga+', differenza '+pm)+'"><div class="psi-scoreviz-head"><span>Gol fatti</span><strong>'+E(gf)+' : '+E(ga)+'</strong><span>Gol subiti</span></div>'+
  '<div class="psi-scoreviz-track"><i class="psi-scoreviz-for" style="--viz-width:'+win+'%"></i><i class="psi-scoreviz-against" style="--viz-width:'+loss+'%"></i></div>'+
  '<div class="psi-scoreviz-scale"><span>'+E(total?Math.round(win):0)+'% GF</span><span>'+E(total?Math.round(loss):0)+'% GS</span></div></div>';
}
function vizRecord(w,d,loss,valid){
 if(!valid)return '<p class="psi-note">Risultati delle presenze non riconciliati.</p>';
 const n=w+d+loss;
 if(!n)return '<p class="psi-note">Nessuna gara disputata.</p>';
 return '<div class="psi-recordviz" role="img" aria-label="'+E(w+' vittorie, '+d+' pareggi, '+loss+' sconfitte')+'"><div class="psi-recordviz-track">'+
 [['v',w],['n',d],['p',loss]].map(([k,v])=>'<i data-result="'+k+'" style="--viz-width:'+(v/n*100).toFixed(2)+'%"></i>').join('')+'</div><div class="psi-recordviz-legend">'+
 '<span><i data-result="v"></i>'+E(w)+' vittorie</span><span><i data-result="n"></i>'+E(d)+' pareggi</span><span><i data-result="p"></i>'+E(loss)+' sconfitte</span></div></div>';
}

export function renderPlayerIntelligence(id,source){
 const v=playerIntelligence(id,source),sql=source?.stats||{};
 const rows=(source?.calculatedPlayers||[]).filter(r=>K(r.player_id)===K(id)&&r.appeared===true);
 const reliable=rows.filter(r=>r.score_coverage==='complete'&&r.goals_for_on!=null&&r.goals_against_on!=null);
 const value=k=>sql[k]==null?null:Number(sql[k]);
 const games=value('appearances'),starts=value('starts'),subs=value('subentries');
 const mins=value('minutes'),goals=value('goals'),assists=value('assists');
 const effectiveMinutes=sql.minutesCoverage==='unavailable'||sql.minutes_coverage==='unavailable'?null:mins;
 const fullImpact=sql.impact_coverage==='complete';
 const count=k=>fullImpact?value(k):null; // Never present a subset as a season total.
 const gf=count('goals_for_on'),ga=count('goals_against_on');
 const pm=gf!=null&&ga!=null?gf-ga:null;
 const unit=v.duration||80;
 const per80=(x)=>fullImpact&&effectiveMinutes>0&&x!=null?rate(x,effectiveMinutes,unit):'—';
 const fmt=x=>x==null?'—':number(x);
 const card=(name,val,extra='')=>'<div class="psi-stat"><span>'+E(name)+'</span><strong>'+E(val)+'</strong>'+(extra?'<small>'+E(extra)+'</small>':'')+'</div>';
 const section=(name,desc,content)=>'<section class="psi-area"><div class="psi-area-head"><h2>'+E(name)+'</h2>'+(desc?'<p>'+E(desc)+'</p>':'')+'</div>'+content+'</section>';
 const ribbon=(items)=>{const usable=items.filter(([,val])=>val!=null&&String(val)!=='—'&&String(val)!=='N/D');return usable.length?'<div class="psi-strip">'+usable.map(([name,val,extra])=>card(name,val,extra)).join('')+'</div>':''};
 const ordered=[...(source?.matches||[])].sort((a,b)=>Date.parse(a.kickoff_at||0)-Date.parse(b.kickoff_at||0));
 const matchFacts=Array.isArray(sql.match_minutes)?sql.match_minutes:[];
 const minuteMap=new Map(matchFacts.map(x=>[K(x.match_id),x.valid===true&&x.minutes!=null?Number(x.minutes):null]));
 const minutePoints=ordered.filter(m=>minuteMap.has(K(m.id)));
 const minutesReady=mins!=null&&minutePoints.length===games&&minutePoints.every(m=>minuteMap.get(K(m.id))!=null)&&minutePoints.reduce((n,m)=>n+minuteMap.get(K(m.id)),0)===mins;
 const label=m=>new Date(m.kickoff_at).toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit'});
 // Fixture results are final inputs; SQL appearances are the gate, not reconstructed event appearances.
 const fixtureMap=new Map((source?.fixtures||[]).map(f=>[K(f.id),f]));
 const matchResults=ordered.flatMap(m=>{
  const played=rows.find(r=>K(r.match_id)===K(m.id));
  const f=fixtureMap.get(K(m.fixture_id));
  if(!played||!f||f.status!=='finished'||!Number.isInteger(f.home_score)||!Number.isInteger(f.away_score))return [];
  const home=K(f.home_team_id)===K(source?.team?.id),away=K(f.away_team_id)===K(source?.team?.id);
  if(home===away)return [];
  const forGoals=home?f.home_score:f.away_score,against=home?f.away_score:f.home_score;
  return [{match_id:K(m.id),kickoff_at:m.kickoff_at,venue:home?'home':'away',points:forGoals>against?3:forGoals===against?1:0}];
 });
 const resultsComplete=games!=null&&matchResults.length===games;
 const tally={W:matchResults.filter(x=>x.points===3).length,D:matchResults.filter(x=>x.points===1).length,L:matchResults.filter(x=>x.points===0).length};
 const scoreResults=games===v.games&&starts===v.starts&&v.matches.length===games;
 const completeGoals=scoreResults&&goals===v.goals;
 const completeAssists=scoreResults&&assists===v.assists;
 const line=([name,html])=>'<div class="psi-visual"><h3>'+E(name)+'</h3>'+html+'</div>';
 const ring=(title,vals,ok)=>line([title,ok?donut(vals):'<p class="psi-note">Distribuzione non verificata</p>']);
 const charts=[
 ['Minuti',lineChart(minutesReady?minutePoints.map(m=>minuteMap.get(K(m.id))):[],minutePoints.map(label),'Minuti per partita')],
 ['Plus/minus',lineChart(fullImpact&&rows.length===games&&rows.every(r=>r.score_coverage==='complete'&&r.plus_minus!=null)
   ?ordered.filter(m=>rows.some(r=>K(r.match_id)===K(m.id))).map((m,i,a)=>a.slice(0,i+1).reduce((n,mm)=>n+Number(rows.find(r=>K(r.match_id)===K(mm.id)).plus_minus),0)):[],
   ordered.filter(m=>rows.some(r=>K(r.match_id)===K(m.id))).map(label),'Plus/minus cumulativo')],
 ['Gol + assist',lineChart(completeGoals&&completeAssists?v.matches.map(m=>m.goals+m.assists):[],v.matches.map(m=>m.label),'Gol e assist per partita')]
 ];
 const availableCharts=charts.filter(x=>!x[1].includes('Dati insufficienti per il grafico.')&&!x[1].includes('Nessuna gara con intervalli affidabili.'));
 const tabs='<div class="psi-chart-tabs" role="tablist" aria-label="Andamento">'+availableCharts.map((x,i)=>'<button type="button" role="tab" aria-selected="'+(i===0)+'" tabindex="'+(i===0?'0':'-1')+'" data-psi-tab="'+i+'">'+E(x[0])+'</button>').join('')+'</div>';
 const chartPanels=availableCharts.map((x,i)=>'<div class="psi-chart-panel" role="tabpanel" data-psi-panel="'+i+'"'+(i?' hidden':'')+'>'+x[1]+'</div>').join('');
 const percent=games&&starts!=null?number(starts/games*100)+'%':'—';
 const splitSub=starts===0&&games===subs;
 const timelineComplete=scoreResults&&v.covered===games;
 const comp='Le statistiche non riconciliate vengono omesse e non sostituite con trattini.';
 const usage=section('Impiego','Partecipazione alla stagione',
   '<div class="psi-dashboard-visual">'+vizMatchMinutes(ordered,minuteMap,minutesReady,unit)+'</div>'+ribbon([['Subentri',fmt(subs)],['Panchina inutilizzata',scoreResults?fmt(v.unused):'—'],['Gare intere',mins!=null&&scoreResults?fmt(v.fullGames):'—'],
   ['Minuti / presenza',games&&mins!=null?number(mins/games)+'′':'—'],['Titolarità',percent]])+
   '<details class="psi-expand"><summary>Ingressi e uscite <span>Dettagli</span></summary>'+
   ribbon([['Ingresso medio',timelineComplete&&v.entryMinutes.length?number(v.entryMinutes.reduce((a,b)=>a+b,0)/v.entryMinutes.length)+'′':'—'],
     ['Uscita media',timelineComplete&&v.exitMinutes.length?number(v.exitMinutes.reduce((a,b)=>a+b,0)/v.exitMinutes.length)+'′':'—'],
     ['Ingressi registrati',timelineComplete?fmt(v.entryMinutes.length):'—'],
     ['Uscite registrate',timelineComplete?fmt(v.exitMinutes.length):'—']])+'</details>');
 const attack=section('Produzione','Reti e assist: dettagli senza ripetere i totali iniziali',
   '<div class="psi-dashboard-visual psi-production-viz">'+vizBar('Gol per '+unit+'′',goals!=null&&effectiveMinutes>0?goals*unit/effectiveMinutes:null,Math.max(1,(goals||0)+(assists||0)),'goals')+vizBar('Assist per '+unit+'′',assists!=null&&effectiveMinutes>0?assists*unit/effectiveMinutes:null,Math.max(1,(goals||0)+(assists||0)),'assists')+'</div>'+ribbon([['G+A / '+unit+'′',effectiveMinutes>0&&goals!=null&&assists!=null?rate(goals+assists,effectiveMinutes,unit):'—'],
   ['Gol da subentrato',splitSub?fmt(goals):completeGoals?fmt(v.subGoals):'—'],
   ['Assist da subentrato',splitSub?fmt(assists):completeAssists?fmt(v.subAssists):'—'],
   ['Minuti / gol',goals&&mins?number(mins/goals)+'′':'—'],
   ['Minuti / G+A',goals!=null&&assists!=null&&goals+assists>0&&mins?number(mins/(goals+assists))+'′':'—']])+
   '<details class="psi-expand"><summary>Contesto dei gol <span>Approfondisci</span></summary>'+
   ribbon([['Doppiette',goals!=null&&goals<2?'0':completeGoals?fmt(v.braces):'—'],
   ['Triplette',goals!=null&&goals<3?'0':completeGoals?fmt(v.hattricks):'—'],
   ['Apre le marcature',timelineComplete&&completeGoals?fmt(v.firstGoals):'—'],
   ['Pareggi',timelineComplete&&completeGoals?fmt(v.equalizers):'—'],
   ['Gol del vantaggio',timelineComplete&&completeGoals?fmt(v.leadGoals):'—'],
   ['Gol in rimonta',timelineComplete&&completeGoals?fmt(v.comeFromBehindGoals):'—'],
   ['Gol decisivi (stima)',timelineComplete&&completeGoals?fmt(v.goalWins):'—'],
   ['% gol squadra',completeGoals&&v.teamGoalsDuringAppearances?number(goals/v.teamGoalsDuringAppearances*100)+'%':'—'],
   ['% coinvolgimento',completeGoals&&completeAssists&&v.teamGoalsDuringAppearances?number((goals+assists)/v.teamGoalsDuringAppearances*100)+'%':'—']])+
   '<div class="psi-visual-pair">'+ring('Tempo delle reti',[['1° tempo',v.goalsByPeriod[0]],['2° tempo',v.goalsByPeriod[1]]],timelineComplete&&completeGoals)+
    ring('Stato prima del gol',[['Vantaggio',v.goalsByContext[0]],['Parità',v.goalsByContext[1]],['Svantaggio',v.goalsByContext[2]]],timelineComplete&&completeGoals)+'</div></details>');
 const impact=section('Impatto','Reti segnate e subite durante la presenza',
   '<div class="psi-impact-main">'+vizImpact(gf,ga,pm,fullImpact)+ribbon([['Plus/minus',pm==null?'—':(pm>0?'+':'')+fmt(pm)]])+
   '<div class="psi-impact-rates">'+ribbon([['GF / '+unit+'′',per80(gf)],['GS / '+unit+'′',per80(ga)],['+/- / '+unit+'′',per80(pm)]])+'</div></div>'+
   '<p class="psi-footnote">'+E(fullImpact?'Dati completi · '+games+' presenze verificate':reliable.length+' / '+fmt(games)+' presenze con timeline verificata')+'</p>'+
   '<details class="psi-expand"><summary>Analisi dentro e fuori campo <span>Approfondisci</span></summary>'+
   ribbon([['GF fuori campo',timelineComplete?fmt(v.gfOff):'—'],['GS fuori campo',timelineComplete?fmt(v.gaOff):'—'],
   ['Clean sheet individuali',timelineComplete?fmt(v.cleanOn):'—'],
   ['DR / '+unit+'′ fuori',timelineComplete&&v.offMinutes?rate(v.gfOff-v.gaOff,v.offMinutes,unit):'—'],
   ['Differenza on/off',timelineComplete&&effectiveMinutes>0&&v.offMinutes?number(pm*unit/effectiveMinutes-(v.gfOff-v.gaOff)*unit/v.offMinutes):'—']])+
   ring('Stato del punteggio',[['Vantaggio',v.states.leading],['Parità',v.states.drawing],['Svantaggio',v.states.trailing]],timelineComplete)+'</details>');
 const record=section('Risultati','Esiti delle partite e rendimento per sede',
   vizRecord(tally.W,tally.D,tally.L,resultsComplete)+ribbon([['Win rate',resultsComplete&&games?number(tally.W/games*100)+'%':'—'],
    ['Punti / gara',resultsComplete&&games?number((tally.W*3+tally.D)/games):'—']])+
   '<details class="psi-expand"><summary>Casa, trasferta e cambi <span>Approfondisci</span></summary>'+
   ribbon([['Gare in casa',scoreResults?fmt(v.home.games):'—'],['Gare in trasferta',scoreResults?fmt(v.away.games):'—'],
   ['Gol casa',completeGoals?fmt(v.home.goals):'—'],['Gol trasferta',completeGoals?fmt(v.away.goals):'—'],
   ['Assist casa',completeAssists?fmt(v.home.assists):'—'],['Assist trasferta',completeAssists?fmt(v.away.assists):'—'],
   ['Punti / gara casa',scoreResults&&v.home.games?number(v.home.points/v.home.games):'—'],
   ['Punti / gara trasferta',scoreResults&&v.away.games?number(v.away.points/v.away.games):'—'],
   ['Punti da subentrato',scoreResults?fmt(v.subPoints):'—'],
   ['Punti da titolare',scoreResults?fmt(v.starterPoints):'—'],
   ['Variazione punti dopo ingresso',timelineComplete?fmt(v.entryPointsDelta):'—'],
   ['Variazione punti dopo uscita',timelineComplete?fmt(v.exitPointsDelta):'—']])+'</details>');
 const trend=availableCharts.length?section('Andamento','Seleziona la metrica; passa sui punti del grafico per i valori',
   tabs+'<div class="psi-chart-stage">'+chartPanels+'</div>'):'';
 return '<div class="psi-root psi-clean" data-player-id="'+E(id)+'">'+usage+attack+impact+record+trend+
  '<p class="psi-disclaimer">Fonti: statistiche stagionali e cache partita Supabase. '+E(comp)+'</p></div>';
}

/** Interactive charts are confined to the player profile. */
export function initPlayerIntelligence(root=document){
 const host=root.querySelector('.psi-clean');
 if(!host)return;
 const buttons=[...host.querySelectorAll('[data-psi-tab]')],panels=[...host.querySelectorAll('[data-psi-panel]')];
 buttons.forEach((button,index)=>button.addEventListener('click',()=>{
  buttons.forEach((b,i)=>{b.setAttribute('aria-selected',String(i===index));b.tabIndex=i===index?0:-1});
  panels.forEach((panel,i)=>{panel.hidden=i!==index});
 }));
}