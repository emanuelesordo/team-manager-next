import {loadBase,loadSeason,loadIdentity,loadMatchInfo,login,logout,hasSession,get} from './api.js?callups=20261004v2';
import {matchRoute,parseMatchRoute} from './match-route.js';
import {normalized,involvesTeam,isFinished,isLive,hasScore,scoreOf,summary,rankRows,fixtureToMatch,roleName,matchMinutes} from './domain.js?clubs=20261003id';
import {CAROUSEL_INTERVAL,LOCALE,TIME_ZONE} from './config.js?home=20261004';
import {monthIndex,renderMonthCalendar,opponentAdjustedResults,renderPointsTrend,renderPlayerRatingTrend} from './home-dashboard.js';
import {clubPage,personalPanel} from './ui-extensions.js?clubs=20261003id';
import {votesPanel,saveVote} from './votes.js';
import {adminPage,staffMatchPanel,isStaff,staffClick,staffSelect,staffSubmit,staffLogoEvent,startStaffClock} from './staff-ui.js?callups=20261004v2';
import {overviewLineup} from './match-overview.js';
import {installCalendarImport} from './calendar-import.js';
import {installLineupPitch,paintLineupPitch,paintCallups} from './lineup-pitch.js?callups=20261004compact';
import {projectionContainer,updateProjection} from './projection-ui.js?clubs=20261003id';
import {profilePanel,installAccountUI,maybeRequirePasswordChange} from './account-ui.js';
import {teamAnalyticsPanel,eventAnalyticsPlaceholder,renderEventAnalytics,fixtureEventsPanel} from './analytics-ui.js?clubs=20261003id';
import {cumulativeEventMinute,displayEventMinute} from './match-minutes.js';
import {loadFixtureEvents} from './api.js?callups=20261004v2';

import {matchScorerRows,renderMatchScorers} from './match-scorers.js?clubs=20261003id';
import {matchPlayerLabel} from './match-player-label.js';
import {fixtureVenueDetails} from './venue-format.js?revision=20261003stadium';
import {playerTrendPanel,hydratePlayerTrend} from './player-trend.js';
import {tacticalHistory} from './tactics.js';
import {installNotifications,syncNotificationBell,resetNotifications} from './notifications.js';

const $=s=>document.querySelector(s);
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=u=>{try{const x=new URL(String(u));return ['https:','http:'].includes(x.protocol)?E(x.href):''}catch{return ''}};
const date=v=>v?new Intl.DateTimeFormat(LOCALE,{day:'2-digit',month:'short',timeZone:TIME_ZONE}).format(new Date(v)):'—';
const weekday=v=>v?new Intl.DateTimeFormat(LOCALE,{weekday:'long',day:'numeric',month:'long',timeZone:TIME_ZONE}).format(new Date(v)):'Data da definire';
const time=v=>v?new Intl.DateTimeFormat(LOCALE,{hour:'2-digit',minute:'2-digit',timeZone:TIME_ZONE}).format(new Date(v)):'—';
const ico=(n,size=20)=>{const paths={
 home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',
 trophy:'<path d="M8 3h8v7a4 4 0 0 1-8 0zM8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4M12 14v5m-4 2h8"/>',
 users:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2zM17 5a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 5"/>',
 chart:'<path d="M4 20V10m5 10V5m5 15v-8m5 8V8M2 21h20"/>',
 chevron:'<path d="m9 18 6-6-6-6"/>',back:'<path d="m15 18-6-6 6-6"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
 settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2"/>',
 user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
 moon:'<path d="M20 14a8 8 0 0 1-10-10A8 8 0 1 0 20 14z"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M19 5l-1.5 1.5m-11 11L5 19"/>',
 menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',close:'<path d="M5 5l14 14M19 5 5 19"/>',
 arrow:'<path d="M4 12h16m-7-7 7 7-7 7"/>',pin:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="2"/>',
 refresh:'<path d="M20 7V3l-3 3a8 8 0 1 0 3 9M20 3v5h-5"/>',
 bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21a2 2 0 0 0 4 0"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 spark:'<path d="m2 16 6-6 4 3 9-9m-6 0h6v6"/>'
 };return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[n]||paths.home}</svg>`};
const nav=[['home','home','Home'],['competitions','trophy','Tornei'],['calendar','calendar','Calendario'],['roster','users','Rosa'],['stats','chart','Numeri']];
const state={page:'home',base:null,data:null,season:null,comp:null,match:null,matchTab:'overview',matchData:null,player:null,slide:0,homeMonth:null,filter:'all',mineOnly:false,standingsView:'official',role:'all',q:'',theme:localStorage.getItem('tm_next_theme')==='ice'?'ice':'night',fixtureEvents:[],overlay:null,identity:{user:null,role:null,profile:null},loading:true,loadId:0};
let carouselTimer=null,refreshTimer=null,toastTimer=null,livePollTimer=null,pollBusy=false;
let verifiedEventCache=null,analyticsBusy=false;
async function pollLive(){
 if(pollBusy||document.hidden||state.loading||!state.season||state.overlay||state.page==='admin'||state.page==='match'&&state.matchTab==='staff')return;
 pollBusy=true;const currentSeason=state.season;
 try{
  const updated=await get('app_competition_fixtures','select=*&season_id=eq.'+encodeURIComponent(currentSeason)+'&order=kickoff_at.asc&limit=1000');
  if(currentSeason!==state.season)return;
  const old=state.data?.fixtures||[];
  const changed=updated.length!==old.length||updated.some((f,i)=>f.id!==old[i]?.id||f.status!==old[i]?.status||f.home_score!==old[i]?.home_score||f.away_score!==old[i]?.away_score);
  if(changed)state.data.fixtures=updated;
  if(state.page==='match'&&state.match){
   const m=resolveMatch().operational;
   if(m&&['live','finished'].includes(m.status)){
    const changes=await loadMatchInfo(m.id);
    const present=state.matchData||{};
    const eventVersion=JSON.stringify(changes.events||[]);
    const oldVersion=JSON.stringify(present.events||[]);
    if(eventVersion!==oldVersion){state.matchData=changes;if(!changed)render();return}
   }
  }
  if(changed)render();
 }catch(err){console.warn('Consultazione LIVE temporaneamente non sincronizzata:',err.message)}
 finally{pollBusy=false}
}
function manageLivePolling(){
 clearInterval(livePollTimer);livePollTimer=null;
 if(state.loading||!state.data||!state.season)return;
 if(!fixtures().some(f=>isLive(f)))return;
 livePollTimer=setInterval(pollLive,20000);
}
function comps(){return [...(state.data?.competitions||[])].sort((a,b)=>
 Number(a.tier_level??999)-Number(b.tier_level??999)||
 Number(Boolean(a.parent_competition_id))-Number(Boolean(b.parent_competition_id))||
 String(a.name).localeCompare(String(b.name),'it'))}
function competitionLabel(c){return (c.tier_level!=null?c.tier_level+' · ':'')+
 (c.parent_competition_id?'↳ ':'')+c.name+(c.group_code?' · Girone '+c.group_code:'')}
function fixtures(){return(state.data?.fixtures||[])}
function team(){return state.base?.team||{name:'Team Manager'}}
function fixtureHomeClub(f){return f?.home_team_id===team()?.id?team():(state.base?.opponents||[]).find(o=>o.id===f?.home_opponent_id)||null}
function ownFixtures(){return fixtures().filter(f=>involvesTeam(f,team())).sort((a,b)=>new Date(a.kickoff_at)-new Date(b.kickoff_at))}
function next(){const n=Date.now();return ownFixtures().filter(f=>isLive(f)||(!isFinished(f)&&new Date(f.kickoff_at).getTime()>=n-3600000)).sort((a,b)=>Number(isLive(b))-Number(isLive(a))||new Date(a.kickoff_at)-new Date(b.kickoff_at))[0]||null}
function previous(){return [...ownFixtures()].filter(f=>isFinished(f)).sort((a,b)=>new Date(b.kickoff_at)-new Date(a.kickoff_at))[0]||null}
function competition(id){return comps().find(c=>c.id===id)}
function currentComp(){return competition(state.comp)||comps()[0]}
function club(n,sz='md',ref=null){const o=ref?.team_id? (ref.team_id===team()?.id?team():null):ref?.opponent_id?(state.base?.opponents||[]).find(o=>o.id===ref.opponent_id):null;const img=safeUrl(o?.logo_url);const bg=/^#[0-9a-f]{6}$/i.test(o?.logo_background_color||'')?o.logo_background_color:'';return `<span class="crest ${sz}"${bg?` style="background-color:${E(bg)}"`:''}>${img?`<img alt="" src="${img}" loading="lazy" decoding="async">`:`<span>${E(String(n||'?').slice(0,2)).toUpperCase()}</span>`}</span>`}
function status(f){return isLive(f)?'<span class="status live"><i></i>LIVE</span>':isFinished(f)?'<span class="status end">Terminata</span>':'<span class="status upcoming">In programma</span>'}
function score(f){return hasScore(f)?`${E(f.home_score)} <span>–</span> ${E(f.away_score)}`:'<span class="vs">VS</span>'}
function heading(){return ''}
function topbarPage(){
 const pages={home:['HOME',team()?.name||'Home'],competitions:['TORNEI','Competizioni'],
 calendar:['CALENDARIO','Calendario'],roster:['ROSA','La rosa'],stats:['NUMERI','Statistiche'],
 match:['PARTITA','Match Center'],player:['GIOCATORE',matchPlayerLabel((state.data?.players||[]).find(x=>x.id===state.player))],
 club:['IL CLUB','Squadra e avversarie'],admin:['GESTIONALE','Amministrazione'],account:['ACCOUNT','Area personale']};
 return pages[state.page]||['TEAM MANAGER','Home'];
}
function header(){
 return `<header class="topbar"><div class="mobile-symbol">${club(team().name,'tiny',{team_id:team().id})}</div><div class="topbar-page"><span class="topbar-kicker">${E(topbarPage()[0])}</span><h1>${E(topbarPage()[1])}</h1></div><div class="top-actions"><span class="connection-pill"><i></i> Dati sincronizzati</span><button type="button" class="icon-btn theme-btn" data-action="theme" aria-label="Cambia aspetto">${ico(state.theme==='night'?'sun':'moon')}</button><button type="button" class="icon-btn" data-action="reload" aria-label="Aggiorna dati">${ico('refresh')}</button>${hasSession()?`<button type="button" class="icon-btn bell-btn" data-notifications-open aria-label="Notifiche">${ico("bell")}<span class="notification-count" hidden data-notification-badge></span></button>`:""}<button type="button" class="icon-btn user-btn" data-action="account" aria-label="Area personale">${ico('user')}</button><button type="button" class="icon-btn mobile-more" data-action="menu" aria-label="Apri menu">${ico('menu')}</button></div></header>`
}
function sidebar(){return `<aside class="sidebar"><button class="identity-brand" data-page="home">${club(team().name,'brand',{team_id:team().id})}<span><b>TEAM MANAGER</b><small>THE FOOTBALL EXPERIENCE</small></span></button><div class="sidebar-scroll"><div class="side-label">IL TUO SPAZIO</div><nav class="side-nav">${nav.map(([id,ic,label])=>`<button type="button" class="side-item ${state.page===id?'selected':''}" data-page="${id}">${ico(ic,20)}<span>${label}</span>${state.page===id?`<i class="side-dot"></i>`:''}</button>`).join('')}</nav><div class="side-label">IL CLUB</div><nav class="side-nav"><button type="button" class="side-item ${state.page==='club'?'selected':''}" data-page="club">${ico('settings',20)}<span>Squadra e avversarie</span></button></nav>${isStaff(staffContext())?`<div class="side-label">GESTIONALE</div><nav class="side-nav"><button class="side-item ${state.page==='admin'?'selected':''}" data-page="admin">${ico('settings',20)}<span>Amministrazione</span></button></nav>`:''}</div><div class="sidebar-bottom"><div class="side-label">STAGIONE</div><label class="season-box"><span>${ico('calendar',17)} Stagione sportiva</span><select aria-label="Seleziona stagione" data-season>${state.base.seasons.map(s=>`<option value="${E(s.id)}" ${state.season===s.id?'selected':''}>${E(s.name)}</option>`).join('')}</select></label><button class="account-card" data-action="account">${ico('user')}<span><b>${E(state.identity.profile?.display_name||'Visitatore')}</b><small>${hasSession()?'Account collegato':'Accesso facoltativo'}</small></span>${ico('chevron',15)}</button></div></aside>`}
function mobileNav(){return `<nav class="mobile-nav" aria-label="Navigazione principale">${nav.map(([id,ic,label])=>`<button type="button" data-page="${id}" class="${state.page===id?'active':''}" aria-label="${label}">${ico(ic,21)}<span>${label}</span></button>`).join('')}</nav>`}
function panelTitle(title,action,label='Vedi tutto'){return `<div class="panel-heading"><h2>${E(title)}</h2>${action?`<button class="plain-link" data-page="${action}">${label} ${ico('chevron',15)}</button>`:''}</div>`}
function scorecard(f,compact=false){if(!f)return '<div class="empty">Nessun incontro disponibile.</div>';
 return `<button class="scorecard ${compact?'compact':''}" data-match="${E(f.id)}"><div class="scorecard-top">${status(f)}<span>${E(competition(f.competition_id)?.name||'Partita')} · ${f.round_no!=null?'Giornata '+E(f.round_no):'Calendario'}</span></div><div class="scorecard-main"><div class="scoreclub">${club(f.home_team,compact?'sm':'lg',{team_id:f.home_team_id,opponent_id:f.home_opponent_id})}<strong>${E(f.home_team)}</strong></div><div class="scorecentre"><b>${score(f)}</b><small>${date(f.kickoff_at)} · ${time(f.kickoff_at)}</small></div><div class="scoreclub">${club(f.away_team,compact?'sm':'lg',{team_id:f.away_team_id,opponent_id:f.away_opponent_id})}<strong>${E(f.away_team)}</strong></div></div><div class="scorecard-foot">${ico('pin',14)} <span>${E(fixtureVenueDetails(f,fixtureHomeClub(f)).name||'Campo da definire')}</span><span class="match-cta">Dettagli ${ico('chevron',15)}</span></div></button>`
}
function fixtureRow(f,short=false){return `<button class="fixture-row" data-match="${E(f.id)}"><span class="fixture-date"><b>${date(f.kickoff_at).split(' ')[0]}</b><small>${date(f.kickoff_at).split(' ').slice(1).join(' ')}</small></span><div class="fixture-main"><div class="fixture-clubs">${club(f.home_team,'tiny',{team_id:f.home_team_id,opponent_id:f.home_opponent_id})}<strong>${E(f.home_team)}</strong><span class="fixture-separator">—</span><strong>${E(f.away_team)}</strong>${club(f.away_team,'tiny',{team_id:f.away_team_id,opponent_id:f.away_opponent_id})}</div>${short?'':`<small>${E(competition(f.competition_id)?.name||'Partita')} ${f.round_no!=null?' · G'+E(f.round_no):''} · ${E(fixtureVenueDetails(f,fixtureHomeClub(f)).name||'Campo da definire')}</small>`}</div><span class="fixture-result ${hasScore(f)?'played':''}">${hasScore(f)?E(f.home_score)+'–'+E(f.away_score):time(f.kickoff_at)}</span>${ico('chevron',15)}</button>`}
function standings(comp,limit=0){
 const all=rankRows((state.data?.standings||[]).filter(x=>x.competition_id===comp?.id),comp,fixtures());const rows=limit?all.slice(0,limit):all;
 if(!rows.length)return '<div class="empty">Classifica non disponibile per questa competizione.</div>';
 return `<div class="table-scroller"><table class="standing-table"><thead><tr><th>#</th><th>Squadra</th><th>G</th><th>V</th><th>N</th><th>P</th><th>GF</th><th>GS</th><th>DR</th><th>Pt</th></tr></thead><tbody>${rows.map((r,i)=>`<tr class="${r.team_id===team()?.id?'ours':''}"><td>${i+1}</td><td><span class="standing-team">${club(r.team,'tiny',{team_id:r.team_id,opponent_id:r.opponent_id})}<span>${E(r.team)}</span></span></td><td>${r.played??'—'}</td><td>${r.won??'—'}</td><td>${r.drawn??'—'}</td><td>${r.lost??'—'}</td><td>${r.goals_for??'—'}</td><td>${r.goals_against??'—'}</td><td>${r.goal_difference??'—'}</td><td class="points">${r.points??'—'}</td></tr>`).join('')}</tbody></table></div>`
}
function carouselFixtures(){const a=[previous(),next()].filter(Boolean);return a.filter((f,i)=>a.findIndex(x=>x.id===f.id)===i)}
function hero(){
 const slides=carouselFixtures();if(!slides.length)return '<div class="hero-panel"><div class="empty light">Non ci sono ancora partite in calendario.</div></div>';
 state.slide=Math.min(state.slide,slides.length-1);const f=slides[state.slide];
 return `<section class="hero-panel"><div class="hero-bg"></div><div class="hero-content"><p>${E(competition(f.competition_id)?.name||'Competizione')} ${f.round_no!=null?'· Giornata '+E(f.round_no):''}</p><div class="hero-score"><div class="hero-club">${club(f.home_team,'xl',{team_id:f.home_team_id,opponent_id:f.home_opponent_id})}<strong>${E(f.home_team)}</strong></div><div class="hero-mid"><span class="hero-live">${status(f)}</span><b>${score(f)}</b><small>${date(f.kickoff_at)} · ${time(f.kickoff_at)}</small></div><div class="hero-club">${club(f.away_team,'xl',{team_id:f.away_team_id,opponent_id:f.away_opponent_id})}<strong>${E(f.away_team)}</strong></div></div><div class="hero-bottom"><div class="dots">${slides.map((_,i)=>`<button data-slide="${i}" class="${i===state.slide?'on':''}" aria-label="Mostra partita ${i+1}"></button>`).join('')}</div><div class="hero-arrows"><button data-action="prevslide" aria-label="Precedente">${ico('back',17)}</button><button data-action="nextslide" aria-label="Successiva">${ico('chevron',17)}</button></div><button class="primary-btn" data-match="${E(f.id)}">Dettagli match ${ico('arrow',17)}</button></div></div></section>`;
}

const ratingsHomeCache=new Map();
function monthOnHome(){return Number.isInteger(state.homeMonth)?state.homeMonth:monthIndex(new Date(),TIME_ZONE)}
function monthMarkup(){return renderMonthCalendar(ownFixtures(),team().id,monthOnHome(),club,'<button class="home-plain-link month-nav-detail" data-page="calendar">Dettagli '+ico('arrow',14)+'</button>')}
function homeCompetition(){return competition(next()?.competition_id||previous()?.competition_id)||currentComp()}
function homeRankings(c){
 const ranked=rankRows((state.data?.standings||[]).filter(x=>x.competition_id===c?.id),c,fixtures());
 if(!ranked.length)return '<p class="empty">Nessuna classifica disponibile.</p>';
 const ourPlace=ranked.findIndex(x=>x.team_id===team()?.id);
 const start=ranked.length<=7?0:Math.max(0,Math.min(ranked.length-7,ourPlace<0?0:ourPlace-3));
 return '<div class="home-rankings">'+ranked.slice(start,start+7).map((x,i)=>
  '<div class="home-rank'+(x.team_id===team()?.id?' ours':'')+'"><span>'+Number(start+i+1)+'</span>'+
  club(x.team,'tiny',{team_id:x.team_id,opponent_id:x.opponent_id})+
  '<b>'+E(x.team)+'</b><small>'+E(x.played??0)+' G</small><strong>'+E(x.points??0)+'</strong></div>').join('')+'</div>';
}
function home(){
 const comp=homeCompetition(),playerId=state.identity?.role?.player_id;
 const associated=(state.data?.players||[]).some(p=>p.id===playerId);
 const comparisons=opponentAdjustedResults(fixtures().filter(f=>f.competition_id===comp?.id),team()?.id,5);
 return '<div class="home-feature"><div class="feature-primary"><div data-home-hero>'+hero()+'</div>'+
 '<div class="home-analytics-grid">'+(associated?'<section class="glass panel home-player-section">'+
 '<div class="home-panel-head"><h2>Il mio giocatore</h2></div>'+
 personalPanel(state.identity,state.data,E,ico)+
 '<h3 class="home-chart-title">Rating delle ultime partite</h3><div class="home-player-rating" data-home-ratings="'+E(playerId)+'">'+
 '<p class="muted small">Caricamento valutazioni…</p></div></section>':'')+
 '<section class="glass panel home-expectation-section"><div class="home-panel-head"><h2>Risultati e aspettative</h2></div>'+
 '<p class="home-competition-name">'+E(comp?.name||'Competizione')+'</p>'+
 renderPointsTrend(comparisons)+'</section></div></div>'+ '<aside class="home-side-stack">'+
 '<section class="glass panel home-month-section"><div class="home-right-calendar">'+monthMarkup()+'</div></section>'+
 '<section class="glass panel home-standing-section"><div class="home-panel-head"><h2>Classifica</h2>'+
 '<button class="home-plain-link" data-page="competitions">'+ico('arrow',15)+'</button></div>'+
 '<p class="home-competition-name">'+E(comp?.name||'Competizione')+'</p>'+homeRankings(comp)+'</section></aside></div>';

}
async function hydrateHomeRatings(){
 const id=state.identity?.role?.player_id,box=document.querySelector('[data-home-ratings]');
 if(!id||!box||state.loading||state.page!=='home')return;
 const key=state.season+'|'+id;
 if(ratingsHomeCache.has(key)){box.innerHTML=renderPlayerRatingTrend(ratingsHomeCache.get(key));return}
 if(box.dataset.loading==='true')return;
 box.dataset.loading='true';
 try{
  const q='select=season_id,match_id,kickoff_at,player_id,opponent,avg_rating,votes,sv&season_id=eq.'+
   encodeURIComponent(state.season)+'&player_id=eq.'+encodeURIComponent(id)+'&order=kickoff_at.desc&limit=5';
  const rows=await get('tm_player_recent_votes',q);
  ratingsHomeCache.set(key,rows);
  const el=document.querySelector('[data-home-ratings="'+id+'"]');
  if(el&&state.season+'|'+state.identity?.role?.player_id===key)el.innerHTML=renderPlayerRatingTrend(rows);
 }catch(err){const el=document.querySelector('[data-home-ratings="'+id+'"]');if(el)el.textContent='Valutazioni non disponibili: '+err.message}
 finally{const el=document.querySelector('[data-home-ratings="'+id+'"]');if(el)el.dataset.loading='false'}
}

function competitions(){
 const c=currentComp(),all=fixtures().filter(f=>f.competition_id===c?.id);
 const rounds=[...new Set(all.map(f=>f.round_no).filter(x=>x!=null))].sort((a,b)=>a-b),shown=state.mineOnly?all.filter(f=>involvesTeam(f,team())):all;
 const firstPendingRound=rounds.find(no=>all.some(f=>f.round_no===no&&!isFinished(f)));
 const focusRound=firstPendingRound??rounds[rounds.length-1];
 const parent=c?.parent_competition_id?competition(c.parent_competition_id):null;
 const phaseInfo=c?.parent_competition_id?'<div class="phase-trail"><span>'+E(parent?.name||'Competizione madre')+
  '</span><span>›</span><strong>'+E(c.name)+'</strong>'+
  '<small>Fase autonoma · tutti partono da 0 · nessun risultato ereditato</small></div>':
  (c?.group_code?'<div class="phase-trail"><strong>Regular Season · Girone '+E(c.group_code)+
  '</strong><small>Livello '+E(c.tier_level??'—')+
  ' · Le fasi successive hanno classifiche separate</small></div>':'');
 return `${heading('IL CAMPIONATO','Competizioni','Classifiche e incontri ufficiali, giornata per giornata.')}${phaseInfo}<div class="filters"><div class="segmented">${comps().map(x=>`<button data-comp="${E(x.id)}" class="${c?.id===x.id?'active':''}">${E(competitionLabel(x))}</button>`).join('')}</div><label class="toggle"><input type="checkbox" data-mine ${state.mineOnly?'checked':''}><span>Solo ${E(team().short_name||'la squadra')}</span></label></div><div class="competition-grid"><section class="glass panel comp-stand"><div class="comp-standing-header"><h2>${state.standingsView==='projected'?'Classifica proiettata':'Classifica completa'}</h2><div class="comp-view-toggle" role="group" aria-label="Vista classifica"><button type="button" data-standing-view="official" class="${state.standingsView==='official'?'active':''}" aria-pressed="${state.standingsView==='official'}">Attuale</button><button type="button" data-standing-view="projected" class="${state.standingsView==='projected'?'active':''}" aria-pressed="${state.standingsView==='projected'}">Proiezione</button></div></div>${state.standingsView==='projected'?projectionContainer(c):`${standings(c)}<p class="subnote">La classifica ufficiale usa i punti configurati per la competizione. Gli spareggi seguono il regolamento.</p>`}</section><section class="glass panel comp-rounds">${panelTitle('Calendario del torneo')}<div class="comp-rounds-scroll" data-rounds-scroll>${rounds.length?rounds.map(no=>`<div class="round-block" data-round="${E(no)}" ${no===focusRound?'data-round-focus="true"':''}><div class="round-heading">GIORNATA ${no}<span>${shown.filter(x=>x.round_no===no).length} partite</span></div>${shown.filter(x=>x.round_no===no).map(x=>fixtureRow(x,true)).join('')||'<div class="empty small">Nessuna partita della squadra in questa giornata.</div>'}</div>`).join(''):shown.map(x=>fixtureRow(x,true)).join('')||'<div class="empty">Nessun incontro registrato.</div>'}</div></section></div>`;
}
function calendar(){
 const rows=ownFixtures().filter(f=>state.filter==='all'||(state.filter==='upcoming'?!isFinished(f):isFinished(f))).filter(f=>!state.comp||f.competition_id===state.comp);
 const grouped={};for(const f of rows){const key=new Intl.DateTimeFormat(LOCALE,{month:'long',year:'numeric',timeZone:TIME_ZONE}).format(new Date(f.kickoff_at));(grouped[key]??=[]).push(f)}
 return `${heading('MATCH SCHEDULE','Calendario','Le gare della squadra, dalle prossime date ai risultati passati.')}<div class="filters"><div class="segmented">${[['all','Tutte'],['upcoming','Da giocare'],['results','Risultati']].map(([k,v])=>`<button data-filter="${k}" class="${state.filter===k?'active':''}">${v}</button>`).join('')}</div><select aria-label="Competizione" class="filter-select" data-comp-select><option value="">Tutte le competizioni</option>${comps().map(c=>`<option value="${E(c.id)}" ${state.comp===c.id?'selected':''}>${E(competitionLabel(c))}</option>`).join('')}</select></div><div class="calendar-groups">${Object.entries(grouped).map(([month,a])=>`<section class="glass panel month-card"><div class="month-heading"><h2>${E(month)}</h2><span>${a.length} ${a.length===1?'gara':'gare'}</span></div><div class="fixture-list">${a.map(f=>fixtureRow(f)).join('')}</div></section>`).join('')||'<div class="glass panel empty">Nessuna partita per questo filtro.</div>'}</div>`
}
function roster(){
 const roster=(state.data?.roster||[]).filter(r=>r.active!==false),all=(state.data?.players||[]),stats=state.data?.playerStats||[];
 const items=roster.map(r=>{const p=all.find(p=>p.id===r.player_id);return p?{...p,roster:r,stats:stats.find(s=>s.player_id===p.id)||null}:null}).filter(Boolean).filter(p=>state.role==='all'||roleName(p.generic_role_manual||p.stats?.position_group)===state.role);
 items.sort((a,b)=>(a.last_name||'').localeCompare(b.last_name||'','it'));
 return `${heading('I PROTAGONISTI','La rosa','Giocatori della stagione selezionata, con dati collegati al profilo originale.')}<div class="filters roster-filters"><div class="segmented">${[['all','Tutti'],['P','Portieri'],['D','Difensori'],['C','Centrocampisti'],['A','Attaccanti']].map(([k,l])=>`<button data-role="${k}" class="${state.role===k?'active':''}">${l}</button>`).join('')}</div><label class="local-search">${ico('search',18)}<input id="player-search" placeholder="Cerca giocatore" value="${E(state.q)}" aria-label="Cerca giocatore"></label></div><div class="player-grid">${items.map(p=>playerCard(p)).join('')||'<div class="empty">Nessun giocatore in questa categoria.</div>'}</div><p class="muted small" id="roster-empty" hidden>Nessun giocatore corrisponde alla ricerca.</p>`;
}
function playerCard(p){const s=p.stats||{};const name=(p.first_name||'')+' '+(p.last_name||'');return `<button class="player-card glass" data-player="${E(p.id)}" data-search-name="${E(normalized(name))}"><div class="player-image">${safeUrl(p.photo_url)?`<img src="${safeUrl(p.photo_url)}" alt="" loading="lazy">`:`<span>${E((p.first_name||'?')[0])}${E((p.last_name||'?')[0])}</span>`}<b>${E(state.data?.habitual?.find(x=>x.player_id===p.id)?.shirt_number??p.roster.shirt_number??'·')}</b></div><div class="player-info"><span class="eyebrow">${E(roleName(p.generic_role_manual||s.position_group))} · ${E(p.generic_role_manual||s.position_group||'Giocatore')}</span><h3>${E(name)}</h3><div class="player-metrics"><span>${s.appearances??'—'} <small>pres.</small></span><span>${s.goals??'—'} <small>gol</small></span><span>${s.avg_rating!=null?Number(s.avg_rating).toFixed(1):'—'} <small>voto</small></span></div></div>${ico('chevron',16)}</button>`}
function player(){
 const p=state.data?.players.find(x=>x.id===state.player);if(!p)return'<section class="empty">Giocatore non disponibile.</section>';
 const r=state.data.roster.find(x=>x.player_id===p.id),s=state.data.playerStats.find(x=>x.player_id===p.id)||{};
 const name=(p.first_name||'')+' '+(p.last_name||'');
 const habitual=state.data?.habitual?.find(x=>x.player_id===p.id);
 return `<button class="back-link" data-page="roster">${ico('back')} Torna alla rosa</button><section class="glass player-detail"><div class="player-detail-cover"><div class="big-player-avatar">${safeUrl(p.photo_url)?`<img src="${safeUrl(p.photo_url)}" alt="">`:`<span>${E((p.first_name||'?')[0])}${E((p.last_name||'?')[0])}</span>`}</div><div><p class="eyebrow">SCHEDA GIOCATORE · ${E(roleName(p.generic_role_manual||s.position_group))}</p><h1>${E(name)}</h1><p>${E(p.generic_role_manual||s.position_group||'Ruolo non specificato')} · ${habitual?.shirt_number!=null?'Maglia abituale #'+E(habitual.shirt_number)+' ('+E(habitual.occurrences)+' gare)':r?.shirt_number!=null?'Maglia stagionale #'+E(r.shirt_number):'Numero non disponibile'}</p></div></div><div class="detail-kpis">${[['appearances','Presenze'],['starts','Da titolare'],['minutes','Minuti'],['goals','Gol'],['assists','Assist'],['avg_rating','Voto medio']].map(([k,l])=>`<div><b>${s[k]!=null?(k==='avg_rating'?Number(s[k]).toFixed(2):E(s[k])):'—'}</b><small>${l}</small></div>`).join('')}</div><div class="detail-biography"><div><span>Piede</span><b>${E(p.preferred_foot||'—')}</b></div><div><span>Altezza</span><b>${p.height_cm?E(p.height_cm)+' cm':'—'}</b></div><div><span>Nazionalità</span><b>${E(p.nationality_code||'—')}</b></div><div><span>Gialli / Rossi</span><b>${E(s.yellow_cards??'—')} / ${E(s.red_cards??'—')}</b></div></div></section>${playerTrendPanel(p)}`
}
function stats(){
 const s=summary(fixtures(),team()),p=state.data?.playerStats||[],sorted=(key)=>[...p].filter(x=>x[key]!=null).sort((a,b)=>Number(b[key])-Number(a[key])).slice(0,7);
 const ranking=(title,key,unit='')=>`<section class="glass panel leaderboard">${panelTitle(title)}${sorted(key).length?sorted(key).map((r,i)=>`<div class="leader-row"><span class="leader-position">${String(i+1).padStart(2,'0')}</span><strong>${E((r.first_name||'')+' '+(r.last_name||''))}</strong><div class="leader-bar"><span style="width:${Math.max(3,Math.round(Number(r[key])/(Number(sorted(key)[0][key])||1)*100))}%"></span></div><b>${key==='avg_rating'?Number(r[key]).toFixed(2):E(r[key])}${unit}</b></div>`).join(''):'<div class="empty">Dato non disponibile.</div>'}</section>`;
 return `${heading('DATA & PERFORMANCE','Statistiche','Indicatori calcolati soltanto da risultati ed eventi effettivamente registrati.')}${kpis()}${teamAnalyticsPanel(fixtures(),team())}${eventAnalyticsPlaceholder()}<div class="stats-intro glass panel"><div><span class="eyebrow">STAGIONE IN NUMERI</span><h2>${s.gf} gol segnati <span>/</span> ${s.ga} subiti</h2><p>${s.played} gare concluse con risultato valido</p></div><div class="stats-form">${miniForm()}</div></div><div class="leaderboard-grid">${ranking('Classifica marcatori','goals')}${ranking('Più presenti','appearances')}${ranking('Media voti','avg_rating')}</div>`;
}
function resolveMatch(){const f=fixtures().find(x=>x.id===state.match);const exact=state.data?.matches?.find(m=>m.fixture_id===f?.id);return {fixture:f,operational:f?(exact||fixtureToMatch(f,state.data?.matches||[],state.base.opponents,team())):null}}
function staffContext(){return {state,heading,resolveMatch,loadMatchInfo,involvesTeam,render,toast,reloadAll,refreshLive,logoutUser}}
function admin(){return adminPage(staffContext())}
function matchEventTimeline(events,fixture,playerName,ourTeam,competitionSettings){
 const norm=v=>String(v??'').trim().toLocaleLowerCase('it');
 const homeIsOurs=Boolean(ourTeam?.id&&fixture.home_team_id===ourTeam.id);
 const side=e=>{const s=norm(e.team_side||e.side);if(['home','casa'].includes(s))return 'home';if(['away','ospite'].includes(s))return 'away';if(['team','ours','own'].includes(s))return homeIsOurs?'home':'away';if(['opponent','opposition'].includes(s))return homeIsOurs?'away':'home';return 'unknown'};
 const type=e=>norm(e.event_type);
 const goal=e=>['goal','penalty_goal','penalty_scored','own_goal'].includes(type(e));
 const configuredMinutes=Number(competitionSettings?.minutes_per_period);
 const duration=Number.isFinite(configuredMinutes)&&configuredMinutes>0?configuredMinutes:null;
 const period=e=>{const p=norm(e.payload?.period);if(p==='second_half'||p==='first_half')return p;return duration!==null&&Number(e.minute)>duration?'second_half':'first_half'};
 const absoluteMinute=e=>cumulativeEventMinute(e,competitionSettings);
 const recovery=e=>Math.max(0,Number(e.stoppage_minute)||0);
 const order=e=>{const n=absoluteMinute(e);return n===null?Infinity:n+recovery(e)/100};
 const raw=[...(events||[])].filter(e=>type(e)!=='period_end'&&e.validation_status!=='rejected');
 const ordered=raw.sort((a,b)=>order(a)-order(b)||String(a.created_at||'').localeCompare(String(b.created_at||'')));
 let home=0,away=0;
 const tracked=ordered.map(e=>{if(goal(e)){let s=side(e);if(type(e)==='own_goal')s=s==='home'?'away':s==='away'?'home':'unknown';if(s==='home')home++;if(s==='away')away++;}return {event:e,score:goal(e)?home+' - '+away:null}});
 const heading=label=>'<div class="mt-divider"><span>'+E(label)+'</span></div>';
 const cards=e=>{
  const t=type(e),shirt=String(e.payload?.opponent_shirt_number||'');
  const cumulative=t==='second_yellow'||(t==='red_card'&&['second_yellow_blue','second_card'].includes(e.payload?.card_type));
  let history=Array.isArray(e.payload?.accumulated_cards)?e.payload.accumulated_cards.slice(-2):[];
  if(cumulative&&!history.length){
   history=ordered.filter(previous=>{
    if(!['yellow_card','blue_card'].includes(type(previous))||side(previous)!==side(e))return false;
    if(e.player_id)return previous.player_id===e.player_id;
    return !!shirt&&String(previous.payload?.opponent_shirt_number||'')===shirt;
   }).filter(previous=>order(previous)<order(e)||(order(previous)===order(e)&&String(previous.created_at||'')<=String(e.created_at||'')))
    .slice(-2).map(previous=>type(previous));
  }
  const colors=cumulative?[...history.map(c=>c==='blue_card'?'blue':'yellow'),'red']:[t==='red_card'?'red':t==='blue_card'?'blue':'yellow'];
  if(cumulative&&colors.length===1)colors.unshift('yellow');
  return '<span class="mt-card-stack" aria-label="Cartellino">'+colors.map(c=>'<i class="mt-card-'+c+'"></i>').join('')+'</span>';
 };
 const icon=e=>{const t=type(e);if(goal(e))return '';if(['yellow_card','red_card','blue_card','second_yellow'].includes(t))return cards(e);if(['substitution','sub_out','sub_in'].includes(t))return '<span class="mt-change" aria-label="Sostituzione"><span class="mt-sub-in">→</span><span class="mt-sub-out">←</span></span>';if(t==='blue_return')return '<span class="mt-generic">↩</span>';return '<span class="mt-generic">◆</span>'};
 const eventContent=entry=>{const e=entry.event,t=type(e),isChange=['substitution','sub_out','sub_in'].includes(t);
  const primary=isChange&&e.secondary_player_id?playerName(e.secondary_player_id):e.player_id?playerName(e.player_id):goal(e)?'Gol avversario':e.payload?.opponent_shirt_number?'#'+e.payload.opponent_shirt_number:'Squadra';
  const secondary=isChange?(e.secondary_player_id&&e.player_id?playerName(e.player_id):''):(goal(e)&&e.secondary_player_id?playerName(e.secondary_player_id):'');
  const score=entry.score?'<span class="mt-score">'+E(entry.score)+'</span>':'';
  const names='<span class="mt-names"><strong>'+E(primary)+'</strong>'+(secondary?'<small>'+E(secondary)+'</small>':'')+'</span>';
  return (goal(e)?'':'<span class="mt-icon">'+icon(e)+'</span>')+score+names;
 };
 const minutes=e=>E(displayEventMinute(e,competitionSettings).replace('′',"'"));
 const recoveryByPeriod=new Map();
 for(const e of events||[]){if(type(e)==='period_end'){const p=period(e);const n=Number(e.payload?.recovery_minutes??e.stoppage_minute)||0;recoveryByPeriod.set(p,Math.max(n,recoveryByPeriod.get(p)||0))}}
 for(const e of ordered){if(recovery(e)){const p=period(e);recoveryByPeriod.set(p,Math.max(recovery(e),recoveryByPeriod.get(p)||0))}else{const n=absoluteMinute(e);if(n!==null){const p=period(e),end=p==='first_half'?duration:duration*2;if(duration!==null&&n>end)recoveryByPeriod.set(p,Math.max(n-end,recoveryByPeriod.get(p)||0))}}}
 const halfGoals=tracked.filter(x=>period(x.event)==='first_half'&&goal(x.event));
 const halfScore=halfGoals.some(x=>absoluteMinute(x.event)===null)?'? - ?':
  halfGoals.reduce((scores,x)=>{let s=side(x.event);if(type(x.event)==='own_goal')s=s==='home'?'away':s==='away'?'home':'unknown';if(s==='home')scores[0]++;if(s==='away')scores[1]++;return scores},[0,0]).join(' - ');
 const complete=['finished','completed','full_time','ft'].includes(norm(fixture.status));
 const hasSecond=tracked.some(x=>period(x.event)==='second_half')||recoveryByPeriod.has('second_half');
 const descending=[...tracked].reverse();
 const sameMoment=(a,b)=>period(a.event)===period(b.event)&&absoluteMinute(a.event)===absoluteMinute(b.event)&&recovery(a.event)===recovery(b.event);
 const groupedRows=items=>{
  let output='';
  for(let i=0;i<items.length;){
   let j=i+1;while(j<items.length&&sameMoment(items[i],items[j]))j++;
   const group=items.slice(i,j),first=group[0].event;
   const contentFor=which=>group.filter(x=>side(x.event)===which||(which==='away'&&side(x.event)==='unknown'))
    .map(x=>'<div class="mt-group-item">'+eventContent(x)+'</div>').join('');
   output+='<div class="mt-row'+(group.length>1?' mt-minute-group':'')+'"><div class="mt-side mt-home"><div class="mt-stack">'+contentFor('home')+'</div></div><b class="mt-minute">'+minutes(first)+'</b><div class="mt-side mt-away"><div class="mt-stack">'+contentFor('away')+'</div></div></div>';
   i=j;
  }
  return output;
 };
 const renderPeriod=p=>{
  const entries=descending.filter(x=>period(x.event)===p);
  const base=duration===null?null:p==='first_half'?duration:duration*2;
  const added=x=>{const n=absoluteMinute(x.event);return recovery(x.event)>0||(base!==null&&n!==null&&n>=base)};
  const stoppage=entries.filter(added),regular=entries.filter(x=>!added(x));
  const declared=Number(recoveryByPeriod.get(p))||0;
  let output=groupedRows(stoppage);
  if(declared>0||stoppage.length)output+=heading(declared>0?'RECUPERO +'+E(declared)+"'":'RECUPERO');
  return output+groupedRows(regular);
 };
 let parts=heading(complete?'FT '+E(fixture.home_score??home)+' - '+E(fixture.away_score??away):'EVENTI');
 if(hasSecond)parts+=renderPeriod('second_half')+heading('HT '+halfScore);
 parts+=renderPeriod('first_half');
 return '<div class="match-timeline" aria-label="Cronologia eventi della partita">'+(tracked.length||recoveryByPeriod.size?parts:parts+'<div class="empty padded">Nessun evento registrato.</div>')+'</div>';
}

function match(){
 const {fixture:f,operational:m}=resolveMatch();if(!f)return '<section class="empty">Partita non disponibile.</section>';
 const data=state.matchData||{players:[],events:[],ratings:[],ratingMeans:[]};
 const comp=competition(f.competition_id);
 const people=id=>(state.data?.players||[]).find(p=>p.id===id);
 const playerName=id=>matchPlayerLabel(people(id));
 const activeEvents=(data.events||[]).filter(e=>e.validation_status!=='rejected');
 const pending=activeEvents.filter(e=>['proposed','community_confirmed','disputed'].includes(e.validation_status)).length;
 const timeline=m?matchEventTimeline(activeEvents,f,playerName,team(),comp):
  (state.fixtureEvents?.length?fixtureEventsPanel(state.fixtureEvents,comp):'<div class="empty">Nessun tabellino associato.</div>');
 const formation=m?overviewLineup(m,data,state.data?.players||[],state.data?.playerStats||[],comp):
  '<div class="empty">Formazione non disponibile: partita senza tabellino operativo.</div>';
 const tabs=[['overview','Overview'],['events','Eventi'],['lineup','Formazioni'],['ratings','Voti'],...(isStaff(staffContext())?[['staff','Gestione']]:[])];
 const selectedTab=state.matchTab==='summary'?'overview':state.matchTab;
 const titleInfo=(label,value)=>value?'<span class="match-meta-item" title="'+E(label)+'"><small class="sr-only">'+E(label)+'</small><strong>'+E(value)+'</strong></span>':'';
 const {name:venue,address}=fixtureVenueDetails(f,fixtureHomeClub(f));
 const matchMeta='<div class="match-header-meta" aria-label="Dettagli partita">'+
  '<div class="match-meta-group match-meta-left">'+
   titleInfo('Competizione',comp?.name||'—')+
   titleInfo('Giornata',f.round_no!=null?f.round_no:'—')+'</div>'+
  '<div class="match-meta-group match-meta-center">'+
   titleInfo('Data',weekday(f.kickoff_at))+
   titleInfo('Ora',time(f.kickoff_at))+'</div>'+
  '<div class="match-meta-group match-meta-right">'+
   titleInfo('Luogo',address||'—')+
   titleInfo('Campo',venue||'—')+'</div></div>';
 const scorers=matchScorerRows(activeEvents,f,team(),playerName,comp);
 const headerScore=hasScore(f)?E(f.home_score)+' <span class="match-score-separator" aria-hidden="true">-</span> '+E(f.away_score):'<span class="vs">VS</span>';
 const compactHeader='<div class="match-compact-bar glass" aria-hidden="true">'+
  '<div class="match-compact-club match-compact-home">'+club(f.home_team,'sm',{team_id:f.home_team_id,opponent_id:f.home_opponent_id})+
  '<strong>'+E(f.home_team)+'</strong></div>'+
  '<b class="match-compact-score">'+headerScore+'</b>'+
  '<div class="match-compact-club match-compact-away"><strong>'+E(f.away_team)+'</strong>'+
  club(f.away_team,'sm',{team_id:f.away_team_id,opponent_id:f.away_opponent_id})+'</div></div>';
 const header='<div class="match-detail-head glass">'+
  '<div class="match-expanded">'+matchMeta+
  '<div class="match-detail-score"><div class="match-header-team match-header-team-home">'+club(f.home_team,'xl',{team_id:f.home_team_id,opponent_id:f.home_opponent_id})+
  '<strong>'+E(f.home_team)+'</strong>'+renderMatchScorers(scorers,'home',E)+'</div>'+
  '<div class="match-big-score"><div class="match-score-status">'+status(f)+'</div><b>'+headerScore+'</b></div>'+
  '<div class="match-header-team match-header-team-away">'+club(f.away_team,'xl',{team_id:f.away_team_id,opponent_id:f.away_opponent_id})+
  '<strong>'+E(f.away_team)+'</strong>'+renderMatchScorers(scorers,'away',E)+'</div></div></div>'+
  '</div>';
 const resultStatus=f.status==='finished'&&m?(m.result_review_status==='confirmed'?'Risultato confermato':'Risultato da verificare'):'';
 const notice=(pending?'<p class="data-warning">'+pending+' eventi ancora da ufficializzare.</p>':'')+
  (resultStatus?'<p class="staff-help">'+E(resultStatus)+'</p>':'');
 let body='';
 if(selectedTab==='staff')body=staffMatchPanel(staffContext(),f,m);
 else if(selectedTab==='events')body='<div class="inner-card"><h3>Cronologia eventi</h3>'+timeline+'</div>';
 else if(selectedTab==='lineup')body='<div class="inner-card">'+formation+'</div>';
 else if(selectedTab==='ratings')body=votesPanel({match:m,data,people:state.data?.players||[],userId:state.identity.user,loggedIn:hasSession(),escape:E});
 else body='<div class="match-overview-grid"><div class="inner-card match-overview-events"><h3>Eventi</h3>'+timeline+
  '</div><div class="inner-card match-overview-formation">'+formation+'</div></div>';
 return '<button class="back-link" data-page="calendar">'+ico('back')+' Torna al calendario</button>'+
  '<div class="match-header-sentinel" aria-hidden="true"></div>'+header+compactHeader+'<section class="glass panel detail-panel"><div class="tab-scroll" role="tablist" aria-label="Dettaglio partita">'+
  tabs.map(([id,label])=>'<button role="tab" aria-selected="'+(selectedTab===id)+'" data-tab="'+id+
   '" class="'+(selectedTab===id?'active':'')+'">'+label+'</button>').join('')+
  '</div><div class="match-tab-body">'+notice+body+(selectedTab==='lineup'?
  tacticalHistory(data.tacticalChanges||[],state.data?.players||[]):'')+'</div></section>';
}
function clubScreen(){return clubPage({team:team(),seasons:state.base.seasons,season:state.season,opponents:state.base.opponents,E,crest:club,heading,ico})}
function settings(){
 const season=state.base.seasons.find(s=>s.id===state.season);
 return heading('IL TUO ACCOUNT','Area personale','Il tuo profilo, le credenziali e la stagione attiva.')+
  profilePanel(state.identity,season?.name)+
  (hasSession()?'<div class="account-signout"><button type="button" class="soft-btn" data-action="logout">Esci dall’account</button></div>':'');
}
function overlay(){
 if(!state.overlay)return '';
 if(state.overlay==='login')return `<div class="overlay" data-dismiss><section class="overlay-card" role="dialog" aria-modal="true" aria-label="Accedi"><button class="close-overlay" data-action="close" aria-label="Chiudi">${ico('close')}</button><span class="eyebrow">AREA RISERVATA</span><h2>Bentornato in squadra.</h2><p>Accedi con le credenziali già configurate su Team Manager.</p><form id="login-form"><label>Username<input name="username" autocomplete="username" required placeholder="Il tuo username"></label><label>Password<input name="password" type="password" autocomplete="current-password" required placeholder="••••••••"></label><div id="login-error" class="form-error" aria-live="polite"></div><button type="submit" class="primary-btn">Accedi ${ico('arrow',17)}</button><button type="button" data-account-recover class="account-recover">Password dimenticata?</button></form></section></div>`;
 if(state.overlay==='menu')return `<div class="overlay" data-dismiss><section class="overlay-card menu-sheet" role="dialog" aria-modal="true" aria-label="Menu"><button class="close-overlay" data-action="close" aria-label="Chiudi">${ico('close')}</button><h2>Esplora Team Manager</h2><label class="season-box dark"><span>Stagione</span><select data-season>${state.base.seasons.map(s=>`<option value="${E(s.id)}" ${s.id===state.season?'selected':''}>${E(s.name)}</option>`).join('')}</select></label>${nav.map(([id,ic,l])=>`<button class="menu-link" data-page="${id}">${ico(ic)} ${l} ${ico('chevron',16)}</button>`).join('')}<button class="menu-link" data-page="club">${ico('settings')} Squadra e avversarie ${ico('chevron',16)}</button>${isStaff(staffContext())?`<button class="menu-link" data-page="admin">${ico('settings')} Amministrazione ${ico('chevron',16)}</button>`:''}<button class="menu-link" data-page="account">${ico('user')} Profilo ${ico('chevron',16)}</button></section></div>`;
 return '';
}
// The expanded header keeps its natural size. Its separate compact sibling is
// sticky but occupies ZERO additional flow height (cancelled by CSS margins).
// Only compositor-friendly opacity and transform change while scrolling: resizing
// the sticky header on each scroll frame caused reflow and scroll-anchor jitter.
let matchHeaderFrame=0;
let matchHeaderLastElement=null;
let matchHeaderLastProgress=-1;
function paintMatchHeaderCompact(){
 if(state.page!=='match')return;
 const head=document.querySelector('.match-detail-head');
 const compact=document.querySelector('.match-compact-bar');
 const expanded=head?.querySelector('.match-expanded');
 const topbar=document.querySelector('.topbar');
 if(!head||!compact||!expanded||!topbar)return;
 const top=Math.ceil(topbar.getBoundingClientRect().bottom);
 const mobile=window.innerWidth<=650;
 const compactHeight=mobile?64:74;
 const range=mobile?120:170;
 const bottom=head.getBoundingClientRect().bottom;
 const raw=Math.max(0,Math.min(1,(top+compactHeight+range-bottom)/range));
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const progress=reduced?(raw>=0.5?1:0):raw;
 // Top offset and compact size change on resize only, not during normal scroll.
 if(compact.dataset.dock!==String(top)){
  compact.style.setProperty('--match-sticky-top',top+'px');
  compact.dataset.dock=String(top);
 }
 if(compact.dataset.size!==String(compactHeight)){
  compact.style.setProperty('--match-compact-height',compactHeight+'px');
  compact.dataset.size=String(compactHeight);
 }
 if(matchHeaderLastElement===compact&&Math.abs(matchHeaderLastProgress-progress)<0.003)return;
 matchHeaderLastElement=compact;
 matchHeaderLastProgress=progress;
 compact.style.opacity=progress.toFixed(3);
 expanded.style.opacity=(1-progress).toFixed(3);
 compact.style.transform=reduced?'none':
  'translate3d(0,'+(10*(1-progress)).toFixed(2)+'px,0) scale('+(0.985+0.015*progress).toFixed(4)+')';
 expanded.style.transform=reduced?'none':
  'translate3d(0,'+(-10*progress).toFixed(2)+'px,0)';
}
function syncMatchHeaderCompact(){
 if(state.page!=='match'||matchHeaderFrame)return;
 matchHeaderFrame=window.requestAnimationFrame(()=>{
  matchHeaderFrame=0;
  paintMatchHeaderCompact();
 });
}
function sizeClubEditor(){
 const el=document.querySelector('.staff-editor-club');
 if(!el)return;
 if(window.matchMedia('(max-width:760px)').matches){
  el.style.removeProperty('--club-editor-height');return;
 }
 const rect=el.getBoundingClientRect();
 // Reserve the visible part of the viewport, regardless of header and tab height.
 const view=window.visualViewport?.height||window.innerHeight;
 const remaining=Math.max(290,Math.round(view-Math.max(0,rect.top)-14));
 el.style.setProperty('--club-editor-height',remaining+'px');
}
function render(){
 if(!state.base)return;
 const previousHomeScroll=state.page==='home'?Array.from(document.querySelectorAll('.home-feature>.feature-primary,.home-feature>.home-side-stack'),column=>column.scrollTop):[];
 const section={home,competitions,calendar,roster,stats,match,player,club:clubScreen,admin,account:settings}[state.page]||home;
 document.body.dataset.page=state.page;
 document.body.dataset.theme=state.theme;
 document.body.dataset.logoShape=['circle','rounded','square'].includes(state.base.team?.logo_shape)?state.base.team.logo_shape:'rounded';
 $('#app').innerHTML=`<div class="ambient ambient-a"></div><div class="ambient ambient-b"></div><div class="shell">${sidebar()}<div class="workspace">${header()}<main class="content" id="main">${state.loading?`<div class="loading-state"><div class="loader"></div>Caricamento dati stagione…</div>`:section()}${!state.loading&&Object.keys(state.data?.errors||{}).length?`<div class="data-warning">Alcune sezioni non sono accessibili al profilo attuale: ${E(Object.keys(state.data.errors).join(', '))}.</div>`:''}</main><footer class="footer">TEAM MANAGER <span>·</span> Dati sportivi da Supabase <span>·</span> ${E(state.base.seasons.find(s=>s.id===state.season)?.name||'')}</footer></div></div>${mobileNav()}<div id="modal-layer">${overlay()}</div><div id="toast" role="status" aria-live="polite"></div>`;
 if(state.page==='home'&&previousHomeScroll.length===2){
  document.querySelectorAll('.home-feature>.feature-primary,.home-feature>.home-side-stack').forEach((column,index)=>{column.scrollTop=previousHomeScroll[index]||0});
 }
 if(state.page==='competitions'&&!state.loading){const scroller=document.querySelector('[data-rounds-scroll]');const focus=scroller?.querySelector('[data-round-focus]');if(scroller&&focus)scroller.scrollTop=Math.max(0,focus.offsetTop-scroller.offsetTop-90)}
 if(state.page==='admin'&&!state.loading)sizeClubEditor();
 if(state.page==='match'&&!state.loading)paintMatchHeaderCompact();
 if(state.page==='home'&&!state.loading)void hydrateHomeRatings();
 manageCarousel();manageLivePolling();if(hasSession())syncNotificationBell(staffContext());maybeRequirePasswordChange(state.identity);if(state.page==='stats'&&!state.loading)fillAnalytics();if(state.page==='player'&&!state.loading&&state.player)hydratePlayerTrend(state.season,state.player);if(state.page==='competitions'&&!state.loading)updateProjection(currentComp(),fixtures(),state.data?.standings||[],(row)=>{const match=(state.data?.standings||[]).find(x=>('team:'+x.team_id===row.club_id&&x.team_id)||('opponent:'+x.opponent_id===row.club_id&&x.opponent_id));return match?club(row.team,'tiny',{team_id:match.team_id,opponent_id:match.opponent_id}):''});paintLineupPitch();paintCallups();if(state.page==='match'&&isStaff(staffContext()))startStaffClock(staffContext());
}
function toast(message){const el=$('#toast');if(!el)return;el.textContent=message;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),3500)}
function navigate(page){
 if(page==='admin'&&!isStaff(staffContext()))page='home';
 state.page=page;state.overlay=null;state.slide=0;if(page==='calendar')state.comp=null;
 history.replaceState(null,'',page==='match'&&state.match?matchRoute(state.match):'#'+page);
 render();window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
}
function changeSlide(nextIndex){const a=carouselFixtures();if(!a.length)return;state.slide=(nextIndex+a.length)%a.length;const slot=document.querySelector('[data-home-hero]');if(state.page==='home'&&slot){slot.innerHTML=hero();return}render()}
let gesture=null;
document.addEventListener('touchstart',e=>{if(e.target.closest('.hero-panel'))gesture={x:e.changedTouches[0].clientX,y:e.changedTouches[0].clientY}},{passive:true});
document.addEventListener('touchend',e=>{if(!gesture||!e.target.closest('.hero-panel')){gesture=null;return}const dx=e.changedTouches[0].clientX-gesture.x,dy=e.changedTouches[0].clientY-gesture.y;gesture=null;if(Math.abs(dx)>54&&Math.abs(dx)>Math.abs(dy)*1.3)changeSlide(state.slide+(dx<0?1:-1))},{passive:true});
function manageCarousel(){
 clearInterval(carouselTimer);if(state.page!=='home'||state.loading||document.hidden||state.overlay)return;
 if(carouselFixtures().length<2||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 carouselTimer=setInterval(()=>{if(!document.hidden&&!state.overlay&&state.page==='home')changeSlide(state.slide+1)},CAROUSEL_INTERVAL);
}
async function switchSeason(id){
 if(!state.base.seasons.some(x=>x.id===id))return;
 const loadId=++state.loadId;state.season=id;state.comp=null;state.match=null;state.player=null;state.slide=0;state.loading=true;render();
 try{const data=await loadSeason(id,isStaff(staffContext()),state.identity?.role?.role==='admin');if(loadId!==state.loadId)return;state.data=data;state.loading=false;sessionStorage.setItem('tm_next_season',id);render()}
 catch(e){state.loading=false;render();toast('Dati non disponibili: '+e.message)}
}
async function openMatch(id){
 if(!fixtures().some(x=>x.id===id))return;
 state.match=id;state.matchTab='overview';state.matchData=null;state.fixtureEvents=[];navigate('match');
 const matched=resolveMatch().operational;
 const [op,fx]=await Promise.allSettled([matched?loadMatchInfo(matched.id):Promise.resolve(null),loadFixtureEvents(id)]);
 if(state.match!==id)return;
 if(op.status==='fulfilled'){state.matchData=op.value;if(Object.keys(op.value?.errors||{}).length)toast('Dati del tabellino non caricati: '+Object.keys(op.value.errors).join(', '))}
 else toast('Tabellino non caricato: '+op.reason.message);
 if(fx.status==='fulfilled')state.fixtureEvents=fx.value;
 else toast('Eventi fixture non caricati: '+fx.reason.message);
 render();
}
async function reload(){
 const saved=state.season;await switchSeason(saved);toast('Dati aggiornati')}
async function refreshLive(){
 if(state.page!=='match'||!state.match)return;
 const id=state.match;
 const f=await get('app_competition_fixtures','select=*&id=eq.'+encodeURIComponent(id));
 if(state.match!==id)return;
 if(f.length){const i=state.data.fixtures.findIndex(x=>x.id===id);if(i>=0)state.data.fixtures[i]=f[0]}
 state.fixtureEvents=await loadFixtureEvents(id).catch(()=>[]);
 const m=resolveMatch().operational;
 if(m){
  const rows=await get('app_matches','select=*&id=eq.'+encodeURIComponent(m.id));
  if(rows.length){const i=state.data.matches.findIndex(x=>x.id===m.id);if(i>=0)state.data.matches[i]=rows[0]}
  state.matchData=await loadMatchInfo(m.id);
 }
 if(state.match===id)render();
}
async function fillAnalytics(){
 const box=document.querySelector('[data-event-analysis]');if(!box||!state.data)return;
 if(verifiedEventCache?.season===state.season){
  box.innerHTML=renderEventAnalytics(fixtures(),state.data.matches||[],verifiedEventCache.events,team(),state.data.competitions||[]);return;
 }
 if(analyticsBusy)return;
 const chosen=state.season,matches=state.data.matches||[],ids=matches.map(m=>m.id).filter(Boolean);
 if(!ids.length){verifiedEventCache={season:chosen,events:[]};box.innerHTML=renderEventAnalytics(fixtures(),matches,[],team(),state.data.competitions||[]);return}
 analyticsBusy=true;
 try{
  const query='select=match_id,event_type,minute,stoppage_minute,team_side,validation_status,payload,created_at&match_id=in.('+
   ids.map(encodeURIComponent).join(',')+')&limit=1000';
  const events=await get('app_match_events',query);
  if(chosen!==state.season)return;
  verifiedEventCache={season:chosen,events};
  const current=document.querySelector('[data-event-analysis]');
  if(current)current.innerHTML=renderEventAnalytics(fixtures(),state.data.matches||[],events,team(),state.data.competitions||[]);
 }catch(error){const current=document.querySelector('[data-event-analysis]');if(current)current.textContent='Eventi non leggibili: '+error.message}
 finally{analyticsBusy=false}
}
async function logoutUser(){document.getElementById('tm-account-dialog')?.remove();resetNotifications();await logout();state.identity={user:null,role:null,profile:null};state.overlay=null;await reloadAll();navigate('home');toast('Sessione chiusa')}
async function reloadAll(){
 const season=state.season;state.base=await loadBase();const chosen=state.base.seasons.some(s=>s.id===season)?season:state.base.seasons.find(s=>s.status==='active')?.id||state.base.seasons[0].id;
 await switchSeason(chosen);
}
document.addEventListener('click',async e=>{
 if(staffLogoEvent(e))return;
 const staffTarget=e.target.closest('[data-staff-action],[data-staff-area],[data-staff-match-tab]');
 if(staffTarget&&await staffClick(e,staffTarget,staffContext()))return;
 const x=e.target.closest('button,[data-dismiss]');if(!x)return;
 if(x.dataset.dismiss!==undefined&&e.target===x){state.overlay=null;render();return}
 if(x.dataset.page){navigate(x.dataset.page);return}
 if(x.dataset.match){openMatch(x.dataset.match);return}
 if(x.dataset.player){state.player=x.dataset.player;navigate('player');return}
 if(x.dataset.slide!==undefined){changeSlide(Number(x.dataset.slide));return}
 if(x.dataset.homeMonth!==undefined){state.homeMonth=x.dataset.homeMonth==='0'?monthIndex(new Date(),TIME_ZONE):monthOnHome()+Number(x.dataset.homeMonth);const el=document.querySelector('.home-right-calendar');if(el)el.innerHTML=monthMarkup();return}
 if(x.dataset.standingView){state.standingsView=x.dataset.standingView;render();return}
 if(x.dataset.comp){state.comp=x.dataset.comp;render();return}
 if(x.dataset.filter){state.filter=x.dataset.filter;render();return}
 if(x.dataset.role){state.role=x.dataset.role;render();return}
 if(x.dataset.tab){state.matchTab=x.dataset.tab;render();return}
 switch(x.dataset.action){
 case 'prevslide':changeSlide(state.slide-1);break;
 case 'nextslide':changeSlide(state.slide+1);break;
 case 'theme':state.theme=state.theme==='night'?'ice':'night';localStorage.setItem('tm_next_theme',state.theme);render();break;
 case 'reload':reload();break;
 case 'menu':state.overlay='menu';render();break;
 case 'close':state.overlay=null;render();break;
 case 'account':state.overlay=hasSession()?null:'login';if(hasSession())navigate('account');else render();break;
 case 'logout':await logoutUser();break;
 }
});
document.addEventListener('change',e=>{
 if(staffLogoEvent(e))return;
 if(e.target.matches('[data-staff-select]')){staffSelect(e.target,staffContext());return}
 if(e.target.matches('[data-season]'))switchSeason(e.target.value);
 if(e.target.matches('[data-mine]')){state.mineOnly=e.target.checked;render()}
 if(e.target.matches('[data-comp-select]')){state.comp=e.target.value||null;render()}
});
document.addEventListener('paste',e=>{staffLogoEvent(e)});
for(const type of ['pointerdown','pointermove','pointerup','pointercancel','dragstart','dragover','drop']){
 document.addEventListener(type,e=>{staffLogoEvent(e)});
}
document.addEventListener('input',e=>{
 if(staffLogoEvent(e))return;
 if(e.target.id==='player-search'){
  state.q=e.target.value;const query=normalized(state.q);let visible=0;
  document.querySelectorAll('.player-card').forEach(el=>{const show=el.dataset.searchName.includes(query);el.hidden=!show;if(show)visible++});
  const missing=$('#roster-empty');if(missing)missing.hidden=visible>0;
 }
});
document.addEventListener('submit',async e=>{
 if(e.target.matches('[data-vote-form]')){
  e.preventDefault();
  if(!hasSession()){state.overlay='login';render();return}
  const button=e.target.querySelector('[type=submit]'),m=resolveMatch().operational,activeFixture=state.match;
  if(!m){toast('Tabellino non disponibile');return}
  button.disabled=true;button.textContent='Salvataggio…';
  try{
   await saveVote(m.id,e.target.dataset.votePlayer,String(new FormData(e.target).get('rating')??''));
   const updated=await loadMatchInfo(m.id);
   if(activeFixture===state.match){state.matchData=updated;render()}
   toast('Valutazione salvata');
  }catch(error){toast('Voto non salvato: '+(error.message||error));button.disabled=false;button.textContent='Riprova'}
  return;
 }
 if(e.target.matches('[data-staff-form]')){await staffSubmit(e,staffContext());return}
 if(e.target.id!=='login-form')return;e.preventDefault();const b=e.target.querySelector('[type=submit]'),error=$('#login-error');
 b.disabled=true;error.textContent='';
 try{const form=new FormData(e.target),profile=await login(String(form.get('username')||'').trim(),String(form.get('password')||''));state.identity=await loadIdentity();state.identity.profile??=profile;state.overlay=null;await reloadAll();toast('Accesso effettuato.')}
 catch(ex){error.textContent=ex.message;b.disabled=false}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.overlay){state.overlay=null;render()}});
document.addEventListener('visibilitychange',()=>{manageCarousel();manageLivePolling();if(!document.hidden)pollLive()});
window.addEventListener('hashchange',()=>{const matchId=parseMatchRoute(location.hash);if(matchId){if(state.data?.fixtures?.some(f=>f.id===matchId)&&state.match!==matchId)openMatch(matchId);return;}const page=location.hash.slice(1);if(['home','competitions','calendar','roster','stats','club','admin','account'].includes(page)&&page!==state.page)navigate(page)});
async function bootstrap(){
 try{
  state.base=await loadBase();
  const stored=sessionStorage.getItem('tm_next_season');
  const initial=state.base.seasons.find(x=>x.id===stored)||state.base.seasons.find(x=>x.status==='active')||state.base.seasons[0];
  state.season=initial.id;state.identity=await loadIdentity().catch(()=>({user:null,role:null,profile:null}));
  const hash=location.hash.slice(1);if(['home','competitions','calendar','roster','stats','club','admin','account'].includes(hash))state.page=hash;
  await switchSeason(initial.id);
  const directMatch=parseMatchRoute(location.hash);
  if(directMatch&&state.data.fixtures.some(f=>f.id===directMatch))await openMatch(directMatch);
 }catch(e){console.error('Boot error',e);$('#app').innerHTML=`<div class="fatal"><b>Team Manager</b><h1>Connessione non disponibile</h1><p>Non è stato possibile caricare la squadra: ${E(e.message)}</p><button onclick="location.reload()">Riprova</button></div>`}
}
installCalendarImport(()=>staffContext());
installLineupPitch();
installAccountUI(()=>staffContext());
installNotifications(()=>staffContext());
window.addEventListener('resize',sizeClubEditor);
window.addEventListener('scroll',syncMatchHeaderCompact,{passive:true});
window.addEventListener('resize',syncMatchHeaderCompact);
window.visualViewport?.addEventListener('resize',syncMatchHeaderCompact);
window.visualViewport?.addEventListener('resize',sizeClubEditor);
bootstrap();


