import {loadData} from './data.js';

const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const icon=n=>({home:'⌂',calendar:'▦',cup:'◇',squad:'◎',stats:'⌁'}[n]||'•');
const pages=[['home','Home'],['calendar','Calendario'],['competition','Competizione'],['squad','Rosa'],['stats','Statistiche']];
let db=null,seasonId=null,page='home',compId=null;

function activeSeason(){return db.seasons.find(x=>x.id===seasonId)||db.seasons.find(x=>x.status==='active')||db.seasons[0]}
function team(){return db.teams[0]||{name:'Team Manager',short_name:'TM'}}
function comps(){return db.competitions.filter(x=>x.season_id===seasonId)}
function fixtures(){return db.fixtures.filter(x=>x.season_id===seasonId)}
function standings(){return db.standings.filter(x=>x.season_id===seasonId)}
function mine(f){const n=team().name.toLowerCase();return f.home_team?.toLowerCase()===n||f.away_team?.toLowerCase()===n}
function finished(f){return ['finished','final','ft','completed'].includes(String(f.status).toLowerCase())}
function live(f){return ['live','in_progress','playing'].includes(String(f.status).toLowerCase())}
function own(){return fixtures().filter(mine)}
function nextMatch(){const now=Date.now()-7200000;return own().filter(f=>live(f)||(!finished(f)&&new Date(f.kickoff_at)>=now)).sort((a,b)=>live(b)-live(a)||new Date(a.kickoff_at)-new Date(b.kickoff_at))[0]}
function lastMatch(){return own().filter(f=>finished(f)).sort((a,b)=>new Date(b.kickoff_at)-new Date(a.kickoff_at))[0]}
function fmt(d,opt={day:'2-digit',month:'short'}){return new Intl.DateTimeFormat('it-IT',opt).format(new Date(d))}
function time(d){return new Intl.DateTimeFormat('it-IT',{hour:'2-digit',minute:'2-digit'}).format(new Date(d))}
function score(f){return finished(f)||live(f)?esc(f.home_score)+' : '+esc(f.away_score):time(f.kickoff_at)}
function crest(name,large=false){const ours=name===team().name&&team().logo_url;return ours?'<img class="crest '+(large?'large':'')+'" src="'+esc(team().logo_url)+'" alt="">':'<span class="crest fallback '+(large?'large':'')+'">'+esc((name||'?').slice(0,2).toUpperCase())+'</span>'}
function nav(){
 return '<nav class="desktop-nav">'+pages.map(([id,l])=>'<button data-page="'+id+'" class="'+(page===id?'active':'')+'">'+l+'</button>').join('')+'</nav>';
}
function shell(content){
 const t=team(),s=activeSeason();
 return '<header class="top"><button class="brand" data-page="home">'+(t.logo_url?'<img src="'+esc(t.logo_url)+'" alt="">':'<b>TM</b>')+'<span><strong>'+esc(t.name)+'</strong><small>TEAM MANAGER</small></span></button>'+nav()+'<div class="top-actions"><select id="season">'+db.seasons.map(x=>'<option value="'+x.id+'" '+(x.id===seasonId?'selected':'')+'>'+esc(x.name)+'</option>').join('')+'</select><button class="profile">•••</button></div></header><main>'+content+'</main><nav class="mobile-nav">'+pages.map(([id,l])=>'<button data-page="'+id+'" class="'+(page===id?'active':'')+'"><i>'+icon(id)+'</i><span>'+l+'</span></button>').join('')+'</nav>';
}
function matchup(f,hero=false){
 if(!f)return '<div class="empty">Nessuna partita disponibile</div>';
 return '<div class="matchup '+(hero?'hero-match':'')+'"><div class="club">'+crest(f.home_team,hero)+'<strong>'+esc(f.home_team)+'</strong></div><div class="result">'+(live(f)?'<em>● LIVE</em>':'')+'<b>'+score(f)+'</b><small>'+fmt(f.kickoff_at,{weekday:'short',day:'2-digit',month:'short'})+(f.round_no?' · G'+f.round_no:'')+'</small></div><div class="club">'+crest(f.away_team,hero)+'<strong>'+esc(f.away_team)+'</strong></div></div>';
}
function form(){
 return own().filter(finished).sort((a,b)=>new Date(b.kickoff_at)-new Date(a.kickoff_at)).slice(0,5).map(f=>{const home=f.home_team===team().name;const a=home?f.home_score:f.away_score,b=home?f.away_score:f.home_score;return '<span class="'+(a>b?'w':a<b?'l':'d')+'">'+(a>b?'V':a<b?'S':'P')+'</span>'}).join('')||'<small>—</small>';
}
function table(comp){
 const rows=standings().filter(x=>x.competition_id===comp?.id).sort((a,b)=>b.points-a.points||b.goal_difference-a.goal_difference);
 if(!rows.length)return '<div class="empty">Classifica non disponibile</div>';
 return '<div class="standing"><div class="thead"><span>#</span><span>Squadra</span><span>G</span><span>DR</span><span>PT</span></div>'+rows.map((r,i)=>'<div class="trow '+(r.team===team().name?'ours':'')+'"><span>'+(i+1)+'</span><span>'+crest(r.team)+esc(r.team)+'</span><span>'+r.played+'</span><span>'+r.goal_difference+'</span><b>'+r.points+'</b></div>').join('')+'</div>';
}
function fixtureRow(f){
 const c=db.competitions.find(x=>x.id===f.competition_id);
 return '<button class="fixture"><span class="date"><b>'+fmt(f.kickoff_at,{day:'2-digit'})+'</b>'+fmt(f.kickoff_at,{month:'short'})+'</span><span class="fxclubs"><strong>'+esc(f.home_team)+'</strong><small>'+esc(c?.name||'Partita')+(f.round_no?' · G'+f.round_no:'')+'</small><strong>'+esc(f.away_team)+'</strong></span><span class="fxscore">'+score(f)+'</span></button>';
}
function home(){
 const n=nextMatch(),l=lastMatch(),comp=comps()[0],done=own().filter(finished);
 let w=0,d=0,loss=0,gf=0,ga=0;
 done.forEach(f=>{const h=f.home_team===team().name,a=h?f.home_score:f.away_score,b=h?f.away_score:f.home_score;gf+=a||0;ga+=b||0;if(a>b)w++;else if(a<b)loss++;else d++});
 const upcoming=own().filter(f=>!finished(f)&&f!==n).slice(0,4);
 return '<section class="home-hero"><div class="stadium-copy"><p class="kicker">MATCH CENTER · '+esc(activeSeason()?.name||'')+'</p><h1>Il calcio della tua squadra,<br><span>in un solo posto.</span></h1><p class="lead">Calendario, risultati, classifica e rosa sempre sincronizzati.</p></div><div class="spotlight"><div class="spot-top"><span>'+(live(n)?'IN DIRETTA':'PROSSIMA PARTITA')+'</span><span>'+esc(db.competitions.find(x=>x.id===n?.competition_id)?.name||'')+'</span></div>'+matchup(n,true)+'<div class="spot-foot"><span>'+(n?.venue_name||n?.venue||team().home_venue_name||'')+'</span><button data-page="calendar">Calendario →</button></div></div></section>'+
 '<section class="dashboard"><div class="metrics"><article><small>PARTITE</small><b>'+done.length+'</b><span>giocate</span></article><article><small>VITTORIE</small><b>'+w+'</b><span>'+form()+'</span></article><article><small>GOL</small><b>'+gf+'</b><span>fatti · '+ga+' subiti</span></article><article><small>BILANCIO</small><b>'+d+' / '+loss+'</b><span>pareggi / sconfitte</span></article></div>'+
 '<div class="home-grid"><section class="glass next-list"><div class="section-title"><div><small>AGENDA</small><h2>Prossimi incontri</h2></div><button data-page="calendar">Tutti</button></div>'+(upcoming.length?upcoming.map(fixtureRow).join(''):'<div class="empty">Nessun altro incontro programmato</div>')+'</section>'+
 '<section class="glass standing-card"><div class="section-title"><div><small>'+esc(comp?.kind||'COMPETIZIONE')+'</small><h2>'+esc(comp?.name||'Classifica')+'</h2></div><button data-page="competition">Apri</button></div>'+table(comp)+'</section>'+
 '<section class="glass last-card"><div class="section-title"><div><small>ULTIMO RISULTATO</small><h2>Match precedente</h2></div></div>'+matchup(l)+'</section></div></section>';
}
function calendar(){
 const rows=own().sort((a,b)=>new Date(a.kickoff_at)-new Date(b.kickoff_at));
 return '<section class="page-intro"><p class="kicker">STAGIONE '+esc(activeSeason()?.name||'')+'</p><h1>Calendario</h1><p>Tutte le partite della squadra, in ordine cronologico.</p></section><section class="calendar-list">'+rows.map((f,i)=>'<div class="calendar-item"><div class="round">'+(f.round_no?'GIORNATA '+f.round_no:'PARTITA')+'</div>'+matchup(f)+'<div class="venue">'+esc(f.venue_name||f.venue||'')+'</div></div>').join('')+'</section>';
}
function competition(){
 const cs=comps();if(!compId)compId=cs[0]?.id;const c=cs.find(x=>x.id===compId)||cs[0];
 const rows=fixtures().filter(x=>x.competition_id===c?.id).sort((a,b)=>new Date(a.kickoff_at)-new Date(b.kickoff_at));
 return '<section class="page-intro inline"><div><p class="kicker">COMPETIZIONI</p><h1>'+esc(c?.name||'Competizione')+'</h1></div><select id="competition">'+cs.map(x=>'<option value="'+x.id+'" '+(x.id===c?.id?'selected':'')+'>'+esc(x.name)+'</option>').join('')+'</select></section><section class="competition-grid"><div class="glass full-standing"><div class="section-title"><div><small>CLASSIFICA</small><h2>Posizioni</h2></div></div>'+table(c)+'</div><div class="glass rounds"><div class="section-title"><div><small>CALENDARIO</small><h2>Partite</h2></div></div>'+rows.map(fixtureRow).join('')+'</div></section>';
}
function squad(){
 const stats=db.stats.filter(x=>x.season_id===seasonId);const ros=db.roster.filter(x=>x.season_id===seasonId&&x.active!==false);
 const cards=ros.map(r=>{const p=db.players.find(x=>x.id===r.player_id)||{},s=stats.find(x=>x.player_id===r.player_id)||{};return '<article class="player"><div class="player-photo">'+(p.photo_url?'<img src="'+esc(p.photo_url)+'" alt="">':'<span>'+esc((p.first_name||'?')[0]+(p.last_name||'?')[0])+'</span>')+'<b>'+(r.shirt_number??'—')+'</b></div><div><small>'+esc(s.position_group||p.generic_role_manual||'ROSA')+'</small><h3>'+esc((p.first_name||s.first_name||'')+' '+(p.last_name||s.last_name||''))+'</h3><p>'+(s.appearances??0)+' presenze · '+(s.goals??0)+' gol</p></div></article>'}).join('');
 return '<section class="page-intro"><p class="kicker">SQUADRA</p><h1>Rosa</h1><p>Giocatori della stagione attiva.</p></section><section class="players">'+(cards||'<div class="empty">Rosa non disponibile</div>')+'</section>';
}
function stats(){
 const s=db.stats.filter(x=>x.season_id===seasonId);const topGoals=[...s].sort((a,b)=>(b.goals||0)-(a.goals||0)).slice(0,5);const topApps=[...s].sort((a,b)=>(b.appearances||0)-(a.appearances||0)).slice(0,5);
 const ranking=(title,rows,key,suffix='')=>'<section class="glass rank"><div class="section-title"><div><small>LEADER</small><h2>'+title+'</h2></div></div>'+rows.map((x,i)=>'<div class="rank-row"><b>'+(i+1)+'</b><span>'+esc(x.first_name+' '+x.last_name)+'</span><strong>'+(x[key]??0)+suffix+'</strong></div>').join('')+'</section>';
 return '<section class="page-intro"><p class="kicker">DATI</p><h1>Statistiche</h1><p>Numeri individuali della stagione.</p></section><section class="stats-grid">'+ranking('Marcatori',topGoals,'goals')+ranking('Presenze',topApps,'appearances')+'</section>';
}
function render(){
 const views={home,calendar,competition,squad,stats};
 $('#app').innerHTML=shell((views[page]||home)());
 bind();
}
function bind(){
 document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{page=b.dataset.page;history.replaceState(null,'','#'+page);window.scrollTo({top:0,behavior:'smooth'});render()});
 $('#season')?.addEventListener('change',e=>{seasonId=e.target.value;compId=null;render()});
 $('#competition')?.addEventListener('change',e=>{compId=e.target.value;render()});
}
async function init(){
 try{
   $('#app').innerHTML='<div class="loading"><span></span><b>TEAM MANAGER</b><small>Caricamento dati…</small></div>';
   db=await loadData();seasonId=(db.seasons.find(x=>x.status==='active')||db.seasons[0])?.id;
   const hash=location.hash.slice(1);if(pages.some(x=>x[0]===hash))page=hash;
   render();
 }catch(e){console.error(e);$('#app').innerHTML='<div class="fatal"><b>Dati non disponibili</b><p>Impossibile collegarsi al database in questo momento.</p><button onclick="location.reload()">Riprova</button></div>'}
}
init();