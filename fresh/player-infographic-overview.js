// Data fetch is intentionally lazy: pure infographic rendering must run without browser storage.

const E=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const K=value=>String(value??'');
const validRating=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))&&Number(value)>=1&&Number(value)<=10;
const n=value=>value===null||value===undefined||!Number.isFinite(Number(value))?'—':Number(value).toLocaleString('it-IT',{maximumFractionDigits:2});
const pct=(a,b)=>b>0?n(100*a/b)+'%':'—';
const metric=(name,value,extra='')=>'<div class="psi-info-row"><span>'+E(name)+'</span><strong>'+E(value==='—'?'N/D':value)+'</strong>'+(extra?'<small>'+E(extra)+'</small>':'')+'</div>';
const card=(name,content,classes='')=>'<article class="psi-info-card '+classes+'"><h3>'+E(name)+'</h3>'+content+'</article>';
const empty=message=>'<p class="psi-info-empty">'+E(message)+'</p>';
const buckets=['0–15','16–30','31–45','46–60','61–75','76+'];
const whichMinute=t=>Number.isFinite(Number(t))&&Number(t)>=0?Math.min(5,Math.floor(Math.max(0,Number(t)-.000001)/15)):null;

/** Times are only charted when the full official event sample matches the SQL season totals. */
export function intervalChart(goals,assists,{complete=false,goalCount=null,assistCount=null}={}){
 if(!complete||!Array.isArray(goals)||!Array.isArray(assists)||goals.length!==goalCount||assists.length!==assistCount)
  return empty('Distribuzione N/D: minuti degli eventi non completamente verificati.');
 const a=Array(6).fill(0),b=Array(6).fill(0);
 for(const minute of goals){const i=whichMinute(minute);if(i===null)return empty('Minuti gol non verificati.');a[i]++}
 for(const minute of assists){const i=whichMinute(minute);if(i===null)return empty('Minuti assist non verificati.');b[i]++}
 const max=Math.max(1,...a,...b);
 return '<div class="psi-info-bars" role="img" aria-label="Gol e assist per intervallo di 15 minuti">'+
  '<div class="psi-info-barplot">'+a.map((g,i)=>'<div class="psi-info-barcol" title="'+E(buckets[i]+': '+g+' gol, '+b[i]+' assist')+'"><div class="psi-info-barstems">'+
   '<i class="goal" style="height:'+(g/max*100)+'%"><b>'+(g||'')+'</b></i><i class="assist" style="height:'+(b[i]/max*100)+'%"><b>'+(b[i]||'')+'</b></i></div><small>'+E(buckets[i])+'</small></div>').join('')+
  '</div><div class="psi-info-legend"><span><i class="goal"></i>Gol</span><span><i class="assist"></i>Assist</span></div></div>';
}
function recordChart(results,complete,games){
 if(!complete||!games)return empty('Risultati con il giocatore: copertura insufficiente.');
 const total=results.W+results.D+results.L;
 if(total!==games)return empty('Risultati in verifica.');
 const w=results.W/total*100,d=results.D/total*100;
 return '<div class="psi-info-record"><div class="psi-info-ring" style="background:conic-gradient(#34a853 0% '+w+'%,#a3b0c4 '+w+'% '+(w+d)+'%,#df5561 '+(w+d)+'% 100%)"><span><b>'+E(n(total))+'</b><small>partite</small></span></div>'+
 '<div class="psi-info-record-list">'+[['Vittorie',results.W,'win'],['Pareggi',results.D,'draw'],['Sconfitte',results.L,'loss']].map(([name,v,cl])=>'<div class="'+cl+'"><span>'+E(name)+'</span><b>'+v+'</b><small>'+pct(v,total)+'</small></div>').join('')+'</div></div>';
}
function ratingChart(rows,withCrests=false){
 const games=[...(rows||[])].filter(r=>r&&r.kickoff_at).sort((a,b)=>Date.parse(a.kickoff_at)-Date.parse(b.kickoff_at)).slice(-5);
 const withVotes=games.filter(r=>validRating(r.avg_rating));
 if(!withVotes.length)return empty('Nessun rating disponibile per le ultime partite.');
 const x=i=>30+i*360/Math.max(1,games.length-1),y=v=>154-(Number(v)-4)*23;
 const positions=games.map((r,i)=>validRating(r.avg_rating)?[x(i),y(r.avg_rating),r]:null);
 const segments=[];let current=[];
 for(const p of positions){if(p)current.push(p);else if(current.length){segments.push(current);current=[]}}
 if(current.length)segments.push(current);
 const grid=[4,6,8,10].map(v=>'<line x1="30" y1="'+y(v)+'" x2="402" y2="'+y(v)+'" stroke="currentColor" opacity=".12"/><text x="6" y="'+(y(v)+4)+'" font-size="11" opacity=".55">'+v+'</text>').join('');
 const lines=segments.map(arr=>'<polyline fill="none" stroke="#f3be0d" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" points="'+arr.map(p=>p[0]+','+p[1]).join(' ')+'"/>').join('');
 const dots=positions.map(p=>p?'<circle cx="'+p[0]+'" cy="'+p[1]+'" r="5" fill="#f3be0d" stroke="#fff" stroke-width="1.5"><title>'+E(p[2].opponent||'Gara')+': '+E(n(p[2].avg_rating))+'</title></circle><text x="'+p[0]+'" y="'+(p[1]-11)+'" font-size="12" font-weight="700" text-anchor="middle" fill="currentColor">'+E(n(p[2].avg_rating))+'</text>':'').join('');
 const avg=withVotes.reduce((sum,r)=>sum+Number(r.avg_rating),0)/withVotes.length;
 const first=withVotes[0]?.avg_rating,last=withVotes.at(-1)?.avg_rating;
 const delta=withVotes.length>1?Number(last)-Number(first):null;
 const sub=withCrests?'<div class="psi-info-opponents">'+games.map(r=>{
  const src=String(r.logo||'');const safe=/^https:\/\/[^"'<>\s]+$/i.test(src)?src:'';
  return '<div title="'+E(r.opponent||'Avversaria')+'">'+(safe?'<img src="'+E(safe)+'" loading="lazy" alt="">':'<span class="psi-info-crest">⚽</span>')+'<small>'+E((r.opponent||'Gara').slice(0,12))+'</small></div>';
 }).join('')+'</div>':'';
 return '<div class="psi-info-chart-head"><small>'+E(withCrests?'Ultime 5 valutazioni':'Media ultime '+withVotes.length+' gare')+'</small><strong>'+n(avg)+(delta!==null&&!withCrests?'<em class="'+(delta>=0?'up':'down')+'">'+(delta>0?'+':'')+n(delta)+'</em>':'')+'</strong></div>'+
 '<svg class="psi-info-rating-svg" viewBox="0 0 420 174" role="img" aria-label="'+E('Voti delle ultime '+games.length+' partite')+'">'+grid+lines+dots+'</svg>'+sub+
 (!withCrests?'<p class="psi-info-caption">Trend sulle ultime '+withVotes.length+' gare valutate · SV esclusi</p>':'');
}
const ratingCache=new Map();
export async function hydratePlayerOverviewRatings(season,playerId,resolve=()=>({})){
 const nodes=[...document.querySelectorAll('[data-psi-rating-recent],[data-psi-rating-trend]')];
 if(!nodes.length)return;
 const key=K(season)+'|'+K(playerId);
 try{
  let rows=ratingCache.get(key);
  if(!rows){
   const {get}=await import('./api.js');
   rows=await get('tm_player_recent_votes','select=season_id,match_id,kickoff_at,player_id,opponent,avg_rating,votes,sv&season_id=eq.'+
    encodeURIComponent(season)+'&player_id=eq.'+encodeURIComponent(playerId)+'&order=kickoff_at.desc&limit=5');
   ratingCache.set(key,rows);if(ratingCache.size>100)ratingCache.delete(ratingCache.keys().next().value);
  }
  const enriched=rows.map(r=>({...r,...resolve(r)}));
  for(const el of nodes){
   if(el.closest('[data-player-id]')?.dataset.playerId!==K(playerId))continue;
   el.innerHTML=ratingChart(enriched,el.hasAttribute('data-psi-rating-recent'));
  }
 }catch(err){
  for(const el of nodes)if(el.closest('[data-player-id]')?.dataset.playerId===K(playerId))
    el.textContent='Rating temporaneamente non disponibile.';
 }
}

/** Render the reference mockup's 4-by-2 overview without simulated sporting data. */
export function renderPlayerOverview({
 id,stats={},analysis={},ratings=null,impact=null,games=null,starts=null,
 minutes=null,goals=null,assists=null,results=null,resultsComplete=false,
 fullImpact=false,timelineComplete=false,completeGoals=false,completeAssists=false,scoreResults=false
}={}){
 const s=stats||{},v=analysis||{},r=results||{W:0,D:0,L:0};
 const ratingAvg=s.avg_rating==null?'—':n(s.avg_rating);
 const safeValue=value=>value==null?'—':n(value);
 const baseMinutes=minutes>0?minutes:null;
 const goalsPer=goals>0&&baseMinutes?n(baseMinutes/goals)+'′':'—';
 const assistsPer=assists>0&&baseMinutes?n(baseMinutes/assists)+'′':'—';
 const clubGoals=v.teamGoalsDuringAppearances;
 const participation=completeGoals&&completeAssists&&clubGoals>0?pct(goals+assists,clubGoals):'—';
 const firstHalf=timelineComplete&&completeGoals&&completeAssists;
 const eventRows=[
  metric('Ammonizioni',safeValue(s.yellow_cards),minutes>0&&s.yellow_cards>0?'1 ogni '+n(minutes/s.yellow_cards)+'′':''),
  metric('Espulsioni',safeValue(s.red_cards)),
  metric('Cartellini blu',safeValue(s.blue_cards)),
  metric('Ammonizioni / presenza',games>0&&s.yellow_cards!=null?n(s.yellow_cards/games):'—')
 ].join('');
 const totalPoints=resultsComplete?r.W*3+r.D:null;
 const goalsOn=fullImpact?s.goals_for_on:null,againstOn=fullImpact?s.goals_against_on:null;
 const contextual=impact||{};
 const contextualValue=key=>contextual[key]==null?'—':safeValue(contextual[key]);
 return '<div class="psi-overview-grid" aria-label="Panoramica infografica di '+E(id)+'">'+
  card('Ultime 5 partite','<div data-psi-rating-recent aria-live="polite">'+empty('Caricamento voti…')+'</div>','psi-card-rating')+
  card('Gol e assist per intervallo',intervalChart(v.scoredMinutes,v.assistedMinutes,{
   complete:firstHalf,goalCount:goals,assistCount:assists
  }),'psi-card-intervals')+
  card('Risultati con lui in campo',recordChart(r,resultsComplete,games),'psi-card-results')+
  card('Trend rating','<div data-psi-rating-trend aria-live="polite">'+empty('Caricamento andamento…')+'</div>','psi-card-trend')+
  card('Rendimento',metric('Media voto',ratingAvg)+metric('Minuti per gol',goalsPer)+metric('Minuti per assist',assistsPer)+metric('Coinvolgimento nei gol',participation),'psi-card-performance')+
  card('Eventi disciplinari',eventRows,'psi-card-discipline')+
  card('Risultati e impatto',metric('Punti con lui titolare',scoreResults&&starts>0?n(v.starterPoints/starts):'—')+
   metric('Punti per presenza',games>0&&totalPoints!=null?n(totalPoints/games):'—')+
   metric('Gol fatti quando in campo',safeValue(goalsOn))+
   metric('Gol subiti quando in campo',safeValue(againstOn)),'psi-card-impact')+
  card('Contributi decisivi',metric('Gol + assist',goals!=null&&assists!=null?n(goals+assists):'—')+
   metric('Gol del vantaggio',contextualValue('go_ahead_goals'))+
   metric('Gol del pareggio',contextualValue('equalizers'))+
   metric('Vantaggi in rimonta',contextualValue('comeback_go_ahead_goals')),'psi-card-decisive')+
 '</div>';
}
