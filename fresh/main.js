import {loadBase,loadSeason,loadIdentity,loadMatchInfo,login,logout,hasSession,get,adminWrite,rpc,publicRpc} from './api.js?prematch=20261007v1';
import {matchRoute,parseMatchRoute} from './match-route.js';
import {normalized,involvesTeam,isFinished,isLive,hasScore,scoreOf,summary,rankRows,fixtureToMatch,roleName,matchMinutes} from './domain.js?clubs=20261005testisolated';
import {CAROUSEL_INTERVAL,LOCALE,TIME_ZONE} from './config.js?home=20261004';
import {monthIndex,renderMonthCalendar,opponentAdjustedResults,renderPointsTrend,renderPlayerRatingTrend} from './home-dashboard.js';
import {clubPage,personalPanel} from './ui-extensions.js?clubs=20261003id';
import {votesPanel,saveVote,deleteVote} from './votes.js?ratings=20261006picker4';
import {adminPage,staffMatchPanel,isStaff,staffClick,staffSelect,staffSubmit,staffLogoEvent,startStaffClock,openNewPlayer,persistCallupChange,persistLineupSnapshot,matchLineup,staffMatchSection} from './staff-ui.js?prematch=20261006v1';
import {overviewLineup} from './match-overview.js?lineup=20261005eventicons-v4';
import {collectionForClub,shirtSvg} from './kit-editor.js';
import {installCalendarImport} from './calendar-import.js';
import {installLineupPitch,paintLineupPitch,paintCallups} from './lineup-pitch.js?callups=20261005callup-lineup-sync1';
import {projectionContainer,updateProjection} from './projection-ui.js?history=20261006v3';
import {profilePanel,installAccountUI,maybeRequirePasswordChange} from './account-ui.js';
import {eventAnalyticsPlaceholder,renderEventAnalytics,fixtureEventsPanel} from './analytics-ui.js?stats=20261005legacy1';
import {cumulativeEventMinute,displayEventMinute} from './match-minutes.js?live=20261006halftime1';
import {loadFixtureEvents} from './api.js?callups=20261004v2';

import {matchScorerRows,renderMatchScorers} from './match-scorers.js?live=20261005proposed';
import {matchPlayerLabel} from './match-player-label.js';
import {fixtureVenueDetails} from './venue-format.js?revision=20261003stadium';
import {playerTrendPanel,hydratePlayerTrend} from './player-trend.js';
import {tacticalHistory} from './tactics.js';
import {installNotifications,syncNotificationBell,resetNotifications} from './notifications.js';
import {weightedTeamRating} from './team-rating.js?legacy=20261006v1';
import {predictMatch,predictionSignature} from './pre-match-prediction.js?v=20261007v2';
import {preMatchPredictionContainer,renderPreMatchPrediction} from './pre-match-prediction-ui.js?v=20261007v2';
import {buildHypotheticalLineup,renderHypotheticalLineup} from './pre-match-lineup.js?v=20261007v2';

const $=s=>document.querySelector(s);
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=u=>{try{const x=new URL(String(u));return ['https:','http:'].includes(x.protocol)?E(x.href):''}catch{return ''}};
const date=v=>v?new Intl.DateTimeFormat(LOCALE,{day:'2-digit',month:'short',timeZone:TIME_ZONE}).format(new Date(v)):'—';
const shortDate=v=>v?new Intl.DateTimeFormat(LOCALE,{day:'2-digit',month:'2-digit',year:'2-digit',timeZone:TIME_ZONE}).format(new Date(v)):'—';
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
const state={page:'home',base:null,data:null,season:null,comp:null,match:null,matchTab:'overview',scoreEditing:false,matchData:null,timelineEditor:null,player:null,slide:0,homeMonth:null,filter:'all',mineOnly:false,standingsView:'official',role:'all',q:'',rosterSort:'name',rosterDesc:false,theme:localStorage.getItem('tm_next_theme')==='ice'?'ice':'night',fixtureEvents:[],overlay:null,identity:{user:null,role:null,profile:null},loading:true,loadId:0};
let carouselTimer=null,refreshTimer=null,toastTimer=null,livePollTimer=null,pollBusy=false;
let verifiedEventCache=null,analyticsBusy=false;
let predictionEventCache=null,predictionBusy=false;
async function pollLive(){
 if(pollBusy||document.hidden||state.loading||!state.season||state.overlay||state.page==='admin'||state.page==='match'&&state.matchTab==='staff')return;
 pollBusy=true;const currentSeason=state.season;
 try{
  const updated=await get('app_competition_fixtures','select=*&season_id=eq.'+encodeURIComponent(currentSeason)+'&order=kickoff_at.asc&limit=1000');
  if(currentSeason!==state.season)return;
  const old=state.data?.fixtures||[];
  let changed=updated.length!==old.length||updated.some((f,i)=>f.id!==old[i]?.id||f.status!==old[i]?.status||f.home_score!==old[i]?.home_score||f.away_score!==old[i]?.away_score);
  if(changed)state.data.fixtures=updated;

  if(state.page==='match'&&state.match){
   const operational=resolveMatch().operational;
   if(operational?.id){
    const matchRows=await get('app_matches','select=*&id=eq.'+encodeURIComponent(operational.id));
    if(matchRows.length){
     const freshMatch=matchRows[0],index=(state.data?.matches||[]).findIndex(x=>x.id===freshMatch.id);
     const prior=index>=0?state.data.matches[index]:null;
     const matchChanged=!prior||JSON.stringify(freshMatch)!==JSON.stringify(prior);
     if(index>=0)state.data.matches[index]=freshMatch;else state.data.matches.push(freshMatch);
     changed=changed||matchChanged;
    }
    const changes=await loadMatchInfo(operational.id);
    const present=state.matchData||{};
    const infoChanged=JSON.stringify(changes)!==JSON.stringify(present);
    if(infoChanged){state.matchData=changes;changed=true}
   }
  }
  if(changed&&!document.querySelector('.live-event-sheet'))render();
 }catch(err){console.warn('Consultazione LIVE temporaneamente non sincronizzata:',err.message)}
 finally{pollBusy=false}
}
function manageLivePolling(){
 clearInterval(livePollTimer);livePollTimer=null;
 if(state.loading||!state.data||!state.season)return;
 if(state.page!=='match'&&!fixtures().some(f=>isLive(f)))return;
 livePollTimer=setInterval(pollLive,30000);
}
function comps(){return [...(state.data?.competitions||[])].filter(c=>c?.phase_rules?.system_private_test!==true).sort((a,b)=>
 Number(a.tier_level??999)-Number(b.tier_level??999)||
 Number(Boolean(a.parent_competition_id))-Number(Boolean(b.parent_competition_id))||
 String(a.name).localeCompare(String(b.name),'it'))}
function competitionLabel(c){return (c.tier_level!=null?c.tier_level+' · ':'')+
 (c.parent_competition_id?'↳ ':'')+c.name+(c.group_code?' · Girone '+c.group_code:'')}
function fixtures(){return(state.data?.fixtures||[])}
function realFixtures(){return fixtures().filter(f=>!f.is_test)}
function team(){return state.base?.team||{name:'Team Manager'}}
function fixtureHomeClub(f){return f?.home_team_id===team()?.id?team():(state.base?.opponents||[]).find(o=>o.id===f?.home_opponent_id)||null}
function ownFixtures(){return fixtures().filter(f=>involvesTeam(f,team())).sort((a,b)=>new Date(a.kickoff_at)-new Date(b.kickoff_at))}
function liveFixture(){return ownFixtures().find(f=>!f.is_test&&isLive(f))||null}
function next(){const n=Date.now();return ownFixtures().filter(f=>!f.is_test).filter(f=>isLive(f)||(!isFinished(f)&&new Date(f.kickoff_at).getTime()>=n-3600000)).sort((a,b)=>Number(isLive(b))-Number(isLive(a))||new Date(a.kickoff_at)-new Date(b.kickoff_at))[0]||null}
function previous(){return [...ownFixtures()].filter(f=>!f.is_test&&isFinished(f)).sort((a,b)=>new Date(b.kickoff_at)-new Date(a.kickoff_at))[0]||null}
function competition(id){return (state.data?.competitions||[]).find(c=>c.id===id)}
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
function currentMatchIsLive(){
 if(state.page!=='match'||!state.match)return false;
 const {fixture,operational}=resolveMatch();
 const live=liveFixture();
 return Boolean(
  fixture&&(
   isLive(fixture)||
   operational?.status==='live'||
   (live&&String(live.id)===String(fixture.id))
  )
 );
}
function liveScoreHeader(){
 const f=liveFixture();if(!f||currentMatchIsLive())return '';
 return `<button type="button" class="global-live-score" data-match="${E(f.id)}" aria-label="Apri partita live: ${E(f.home_team)} ${E(f.home_score??0)} a ${E(f.away_score??0)} ${E(f.away_team)}">
  <span class="global-live-label"><i></i> LIVE</span>
  <span class="global-live-club global-live-home">${club(f.home_team,'tiny',{team_id:f.home_team_id,opponent_id:f.home_opponent_id})}<strong>${E(f.home_team)}</strong></span>
  <b class="global-live-result">${hasScore(f)?E(f.home_score)+'–'+E(f.away_score):'0–0'}</b>
  <span class="global-live-club global-live-away"><strong>${E(f.away_team)}</strong>${club(f.away_team,'tiny',{team_id:f.away_team_id,opponent_id:f.away_opponent_id})}</span>
 </button>`;
}
function sidebar(){return `<aside class="sidebar"><button class="identity-brand" data-page="home">${club(team().name,'brand',{team_id:team().id})}<span><b>TEAM MANAGER</b><small>THE FOOTBALL EXPERIENCE</small></span></button><div class="sidebar-scroll"><div class="side-label">IL TUO SPAZIO</div><nav class="side-nav">${nav.map(([id,ic,label])=>`<button type="button" class="side-item ${state.page===id?'selected':''}" data-page="${id}">${ico(ic,20)}<span>${label}</span>${state.page===id?`<i class="side-dot"></i>`:''}</button>`).join('')}</nav><div class="side-label">IL CLUB</div><nav class="side-nav"><button type="button" class="side-item ${state.page==='club'?'selected':''}" data-page="club">${ico('settings',20)}<span>Squadra e avversarie</span></button></nav>${isStaff(staffContext())?`<div class="side-label">GESTIONALE</div><nav class="side-nav"><button class="side-item ${state.page==='admin'?'selected':''}" data-page="admin">${ico('settings',20)}<span>Amministrazione</span></button></nav>`:''}</div><div class="sidebar-bottom"><div class="side-label">STAGIONE</div><label class="season-box"><span>${ico('calendar',17)} Stagione sportiva</span><select aria-label="Seleziona stagione" data-season>${state.base.seasons.map(s=>`<option value="${E(s.id)}" ${state.season===s.id?'selected':''}>${E(s.name)}</option>`).join('')}</select></label><button class="account-card" data-action="account">${ico('user')}<span><b>${E(state.identity.profile?.display_name||'Visitatore')}</b><small>${hasSession()?'Account collegato':'Accesso facoltativo'}</small></span>${ico('chevron',15)}</button></div></aside>`}
function mobileNav(){return `<nav class="mobile-nav" aria-label="Navigazione principale">${nav.map(([id,ic,label])=>`<button type="button" data-page="${id}" class="${state.page===id?'active':''}" aria-label="${label}">${ico(ic,21)}<span>${label}</span></button>`).join('')}</nav>`}
function panelTitle(title,action,label='Vedi tutto'){return `<div class="panel-heading"><h2>${E(title)}</h2>${action?`<button class="plain-link" data-page="${action}">${label} ${ico('chevron',15)}</button>`:''}</div>`}
function scorecard(f,compact=false){if(!f)return '<div class="empty">Nessun incontro disponibile.</div>';
 return `<button class="scorecard ${compact?'compact':''} ${f.is_test?'is-test':''}" data-match="${E(f.id)}"><div class="scorecard-top">${status(f)}${f.is_test?'<span class="test-badge">TEST PRIVATO</span>':''}<span>${E(competition(f.competition_id)?.name||'Partita')} · ${f.round_no!=null?'Giornata '+E(f.round_no):'Calendario'}</span></div><div class="scorecard-main"><div class="scoreclub">${club(f.home_team,compact?'sm':'lg',{team_id:f.home_team_id,opponent_id:f.home_opponent_id})}<strong>${E(f.home_team)}</strong></div><div class="scorecentre"><b>${score(f)}</b><small>${date(f.kickoff_at)} · ${time(f.kickoff_at)}</small></div><div class="scoreclub">${club(f.away_team,compact?'sm':'lg',{team_id:f.away_team_id,opponent_id:f.away_opponent_id})}<strong>${E(f.away_team)}</strong></div></div><div class="scorecard-foot">${ico('pin',14)} <span>${E(fixtureVenueDetails(f,fixtureHomeClub(f)).name||'Campo da definire')}</span><span class="match-cta">Dettagli ${ico('chevron',15)}</span></div></button>`
}
function fixtureRow(f,short=false){
 const editableTournamentTime=short&&state.identity?.role?.role==='admin'&&!hasScore(f);
 return `<button class="fixture-row ${f.is_test?'is-test':''}" data-match="${E(f.id)}"><span class="fixture-date"><b>${date(f.kickoff_at).split(' ')[0]}</b><small>${date(f.kickoff_at).split(' ').slice(1).join(' ')}</small></span><div class="fixture-main"><div class="fixture-clubs">${club(f.home_team,'tiny',{team_id:f.home_team_id,opponent_id:f.home_opponent_id})}<strong>${E(f.home_team)}</strong><span class="fixture-separator">—</span><strong>${E(f.away_team)}</strong>${club(f.away_team,'tiny',{team_id:f.away_team_id,opponent_id:f.away_opponent_id})}</div>${short?'':`<small>${E(competition(f.competition_id)?.name||'Partita')} ${f.round_no!=null?' · G'+E(f.round_no):''} · ${E(fixtureVenueDetails(f,fixtureHomeClub(f)).name||'Campo da definire')}</small>`}</div>${f.is_test?'<span class="test-badge">TEST</span>':''}<span class="fixture-result ${hasScore(f)?'played':''}${editableTournamentTime?' editable-time':''}" ${editableTournamentTime?'data-tournament-score="'+E(f.id)+'" title="Inserisci risultato finale"':''}>${hasScore(f)?E(f.home_score)+'–'+E(f.away_score):time(f.kickoff_at)}</span>${ico('chevron',15)}</button>`
}
function standings(comp,limit=0){
 const all=rankRows((state.data?.standings||[]).filter(x=>x.competition_id===comp?.id),comp,fixtures());const rows=limit?all.slice(0,limit):all;
 if(!rows.length)return '<div class="empty">Classifica non disponibile per questa competizione.</div>';
 return `<div class="table-scroller"><table class="standing-table"><thead><tr><th>#</th><th>Squadra</th><th>G</th><th>V</th><th>N</th><th>P</th><th>GF</th><th>GS</th><th>DR</th><th>Pt</th></tr></thead><tbody>${rows.map((r,i)=>`<tr class="${r.team_id===team()?.id?'ours':''}"><td>${i+1}</td><td><span class="standing-team">${club(r.team,'tiny',{team_id:r.team_id,opponent_id:r.opponent_id})}<span>${E(r.team)}</span></span></td><td>${r.played??'—'}</td><td>${r.won??'—'}</td><td>${r.drawn??'—'}</td><td>${r.lost??'—'}</td><td>${r.goals_for??'—'}</td><td>${r.goals_against??'—'}</td><td>${r.goal_difference??'—'}</td><td class="points">${r.points??'—'}</td></tr>`).join('')}</tbody></table></div>`
}
function carouselFixtures(){const a=[previous(),next()].filter(Boolean);return a.filter((f,i)=>a.findIndex(x=>x.id===f.id)===i)}
const teamRatingCache=new Map();
function weightedScoreLevel(score){
 return score>=9?'elite':score>=8?'high':score>=7?'above':score>=6?'even':score>=5?'below':'low';
}
function weightedScoreBadge(matchId){
 if(!matchId)return '';
 const value=teamRatingCache.get(String(matchId));
 const visible=Number.isFinite(value);
 return '<span class="team-weighted-score '+(visible?'score-'+weightedScoreLevel(value):'')+'" data-team-weighted-match="'+E(matchId)+'" title="Rating medio squadra ponderato sui minuti effettivamente giocati"'+(visible?'':' hidden')+'>'+
  (visible?E(value.toFixed(2).replace('.',',')):'')+'</span>';
}
function paintTeamWeightedRatings(){
 document.querySelectorAll('[data-team-weighted-match]').forEach(el=>{
  const value=teamRatingCache.get(String(el.dataset.teamWeightedMatch));
  const visible=Number.isFinite(value);
  el.hidden=!visible;
  el.className='team-weighted-score'+(visible?' score-'+weightedScoreLevel(value):'');
  if(visible)el.textContent=value.toFixed(2).replace('.',',');
 });
}
async function publicWeightedRating(matchId){
 try{
  const value=await publicRpc('tm_app_public_weighted_rating',{p_match_id:matchId});
  const n=Number(value);
  return Number.isFinite(n)?n:null;
 }catch{return null}
}
async function hydrateHomeTeamRatings(){
 if(state.page!=='home'||state.loading)return;
 const targets=carouselFixtures().filter(isFinished).map(f=>({f,m:(state.data?.matches||[]).find(x=>x.fixture_id===f.id)})).filter(x=>x.m?.id);
 await Promise.all(targets.map(async({m})=>{
  const value=await publicWeightedRating(m.id);
  teamRatingCache.set(String(m.id),value);
 }));
 if(state.page==='home')paintTeamWeightedRatings();
}
async function hydrateMatchTeamRating(){
 if(state.page!=='match'||state.loading)return;
 const m=resolveMatch().operational;
 if(!m?.id)return;
 const value=await publicWeightedRating(m.id);
 teamRatingCache.set(String(m.id),value);
 if(state.page==='match'&&resolveMatch().operational?.id===m.id)paintTeamWeightedRatings();
}
function fixtureWeightedBadge(f){
 const m=(state.data?.matches||[]).find(x=>x.fixture_id===f?.id);
 return m?weightedScoreBadge(m.id):'';
}
function teamNameWithWeighted(name){
 return '<span class="team-name-rating"><strong>'+E(name)+'</strong></span>';
}
function teamCrestWithWeighted(name,size,ref,badge='',side='home'){
 return '<span class="team-crest-rating team-crest-rating-'+side+'">'+
  (side==='home'?badge:'')+
  club(name,size,ref)+
  (side==='away'?badge:'')+
  '</span>';
}
function hero(){
 const slides=carouselFixtures();if(!slides.length)return '<div class="hero-panel"><div class="empty light">Non ci sono ancora partite in calendario.</div></div>';
 state.slide=Math.min(state.slide,slides.length-1);const f=slides[state.slide];
 const weighted=fixtureWeightedBadge(f);
 const homeBadge=f.home_team_id===team()?.id?weighted:'',awayBadge=f.away_team_id===team()?.id?weighted:'';
 return `<section class="hero-panel"><div class="hero-bg"></div><div class="hero-content"><p>${E(competition(f.competition_id)?.name||'Competizione')} ${f.round_no!=null?'· Giornata '+E(f.round_no):''}</p><div class="hero-score"><div class="hero-club">${teamCrestWithWeighted(f.home_team,'xl',{team_id:f.home_team_id,opponent_id:f.home_opponent_id},homeBadge,'home')}${teamNameWithWeighted(f.home_team)}</div><div class="hero-mid"><span class="hero-live">${status(f)}</span><b>${score(f)}</b><small>${date(f.kickoff_at)} · ${time(f.kickoff_at)}</small></div><div class="hero-club">${teamCrestWithWeighted(f.away_team,'xl',{team_id:f.away_team_id,opponent_id:f.away_opponent_id},awayBadge,'away')}${teamNameWithWeighted(f.away_team)}</div></div><div class="hero-bottom"><div class="dots">${slides.map((_,i)=>`<button data-slide="${i}" class="${i===state.slide?'on':''}" aria-label="Mostra partita ${i+1}"></button>`).join('')}</div><div class="hero-arrows"><button data-action="prevslide" aria-label="Precedente">${ico('back',17)}</button><button data-action="nextslide" aria-label="Successiva">${ico('chevron',17)}</button></div><button class="primary-btn" data-match="${E(f.id)}">Dettagli match ${ico('arrow',17)}</button></div></div></section>`;
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
 const comparisons=opponentAdjustedResults(realFixtures().filter(f=>f.competition_id===comp?.id),team()?.id,5);
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
 const completedRounds=rounds.filter(no=>all.filter(f=>f.round_no===no).every(isFinished));
 const lastCompletedRound=completedRounds.length?completedRounds[completedRounds.length-1]:null;
 const nextRound=rounds.find(no=>no>Number(lastCompletedRound??-Infinity)&&all.some(f=>f.round_no===no&&!isFinished(f)))??null;
 const focusRound=lastCompletedRound??nextRound??rounds[0];
 const followingRound=nextRound!==focusRound?nextRound:null;
 const parent=c?.parent_competition_id?competition(c.parent_competition_id):null;
 const phaseInfo=c?.parent_competition_id?'<div class="phase-trail"><span>'+E(parent?.name||'Competizione madre')+
  '</span><span>›</span><strong>'+E(c.name)+'</strong>'+
  '<small>Fase autonoma · tutti partono da 0 · nessun risultato ereditato</small></div>':
  (c?.group_code?'<div class="phase-trail"><strong>Regular Season · Girone '+E(c.group_code)+
  '</strong><small>Livello '+E(c.tier_level??'—')+
  ' · Le fasi successive hanno classifiche separate</small></div>':'');
 return `${heading('IL CAMPIONATO','Competizioni','Classifiche e incontri ufficiali, giornata per giornata.')}${phaseInfo}<div class="filters"><div class="segmented">${comps().map(x=>`<button data-comp="${E(x.id)}" class="${c?.id===x.id?'active':''}">${E(competitionLabel(x))}</button>`).join('')}</div><label class="toggle"><input type="checkbox" data-mine ${state.mineOnly?'checked':''}><span>Solo ${E(team().short_name||'la squadra')}</span></label></div><div class="competition-grid"><section class="glass panel comp-stand"><div class="comp-standing-header"><h2>${state.standingsView==='projected'?'Classifica proiettata':'Classifica completa'}</h2><div class="comp-view-toggle" role="group" aria-label="Vista classifica"><button type="button" data-standing-view="official" class="${state.standingsView==='official'?'active':''}" aria-pressed="${state.standingsView==='official'}">Attuale</button><button type="button" data-standing-view="projected" class="${state.standingsView==='projected'?'active':''}" aria-pressed="${state.standingsView==='projected'}">Proiezione</button></div></div>${state.standingsView==='projected'?projectionContainer(c):`${standings(c)}<p class="subnote">La classifica ufficiale usa i punti configurati per la competizione. Gli spareggi seguono il regolamento.</p>`}</section><section class="glass panel comp-rounds">${panelTitle('Calendario del torneo')}<div class="comp-rounds-scroll" data-rounds-scroll>${rounds.length?rounds.map(no=>`<div class="round-block" data-round="${E(no)}" ${no===focusRound?'data-round-focus="true"':''} ${no===followingRound?'data-round-next="true"':''}><div class="round-heading">GIORNATA ${no}<span>${shown.filter(x=>x.round_no===no).length} partite</span></div>${shown.filter(x=>x.round_no===no).map(x=>fixtureRow(x,true)).join('')||'<div class="empty small">Nessuna partita della squadra in questa giornata.</div>'}</div>`).join(''):shown.map(x=>fixtureRow(x,true)).join('')||'<div class="empty">Nessun incontro registrato.</div>'}</div></section></div>`;
}
function calendar(){
 const rows=ownFixtures().filter(f=>!state.comp||f.competition_id===state.comp);
 const grouped={};for(const f of rows){const key=new Intl.DateTimeFormat(LOCALE,{month:'long',year:'numeric',timeZone:TIME_ZONE}).format(new Date(f.kickoff_at));(grouped[key]??=[]).push(f)}
 const canCreate=isStaff(staffContext());
 return `${heading('MATCH SCHEDULE','Calendario','Le gare della squadra, dalle prossime date ai risultati passati.')}<div class="filters calendar-toolbar"><select aria-label="Competizione" class="filter-select calendar-comp-filter" data-comp-select><option value="">Tutte le competizioni</option>${comps().map(c=>`<option value="${E(c.id)}" ${state.comp===c.id?'selected':''}>${E(competitionLabel(c))}</option>`).join('')}</select>${canCreate?'<button type="button" class="roster-add calendar-new" data-calendar-new>+ Nuovo</button>':''}</div><div class="calendar-groups">${Object.entries(grouped).map(([month,a])=>`<section class="glass panel month-card"><div class="month-heading"><h2>${E(month)}</h2><span>${a.length} ${a.length===1?'gara':'gare'}</span></div><div class="fixture-list">${a.map(f=>fixtureRow(f)).join('')}</div></section>`).join('')||'<div class="glass panel empty">Nessuna partita per questa competizione.</div>'}</div>`
}
function roster(){
 const roster=(state.data?.roster||[]),all=state.data?.players||[],stats=state.data?.playerStats||[];
 const items=roster.map(r=>{const p=all.find(p=>p.id===r.player_id);return p?{...p,roster:r,stats:stats.find(s=>s.player_id===p.id)||{}}:null}).filter(Boolean).filter(p=>state.role==='all'||roleName(p.generic_role_manual||p.stats?.position_group)===state.role);
 const columns=[['shirt','#'],['name','Giocatore'],['role','Ruolo'],['age','Età'],['appearances','Pres.'],['goals','Gol'],['avg_rating','Rating'],['status','Stato']];
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const age=p=>{if(!p.birth_date)return null;const [y,m,d]=p.birth_date.slice(0,10).split('-').map(Number),[Y,M,D]=today.split('-').map(Number);return y&&m&&d?Y-y-(M<m||M===m&&D<d?1:0):null};
 const active=p=>{const ranges=(state.data?.contracts||[]).filter(c=>c.season_id===state.season&&c.player_id===p.id);return p.roster.active!==false&&(!ranges.length||ranges.some(c=>c.start_date<=today&&today<=c.end_date))};
 const val=(p,key)=>key==='name'?(p.last_name||'')+' '+(p.first_name||''):key==='role'?roleName(p.generic_role_manual||p.stats?.position_group):key==='shirt'?(state.data?.habitual||[]).find(h=>h.player_id===p.id)?.shirt_number??p.roster.shirt_number:key==='age'?age(p):key==='status'?(active(p)?1:0):key==='avg_rating'?p.stats?.avg_rating:p.stats?.[key];
 items.sort((a,b)=>{const x=val(a,state.rosterSort),y=val(b,state.rosterSort),nx=Number(x),ny=Number(y);const blank=v=>v==null||String(v).trim()===''||String(v).trim()==='—'||String(v).trim()==='-';if(blank(x)!==blank(y))return blank(x)?1:-1;const numeric=state.rosterSort!=='name'&&state.rosterSort!=='role';const result=numeric?(blank(x)?0:Number.isFinite(nx)?nx:0)-(blank(y)?0:Number.isFinite(ny)?ny:0):String(x??'').localeCompare(String(y??''),'it',{sensitivity:'base',numeric:true});return (state.rosterDesc?-result:result)||(a.last_name||'').localeCompare(b.last_name||'','it')});
 const query=normalized(state.q);const shown=items.filter(p=>normalized((p.first_name||'')+' '+(p.last_name||'')).includes(query));
 const number=v=>v==null?'—':E(v);
 const table=`<div class="table-scroller roster-table-wrap"><table class="standing-table roster-table"><thead><tr>${columns.map(([key,label])=>`<th><button type="button" data-roster-sort="${key}" aria-label="Ordina per ${label}" aria-sort="${state.rosterSort===key?(state.rosterDesc?'descending':'ascending'):'none'}">${label} ${state.rosterSort===key?(state.rosterDesc?'↓':'↑'):''}</button></th>`).join('')}</tr></thead><tbody>${shown.map(p=>`<tr data-search-name="${E(normalized((p.first_name||'')+' '+(p.last_name||'')))}"><td>${number(val(p,'shirt'))}</td><td><button type="button" class="roster-player-link roster-player-identity" data-player="${E(p.id)}"><span class="roster-avatar">${safeUrl(p.photo_url)?`<img src="${safeUrl(p.photo_url)}" alt="" loading="lazy">`:`<span>${E((p.first_name||'?')[0])}${E((p.last_name||'?')[0])}</span>`}</span><strong>${E((p.last_name||'')+' '+(p.first_name||''))}</strong></button></td><td>${E(roleName(p.generic_role_manual||p.stats?.position_group))}</td><td>${number(age(p))}</td><td>${number(p.stats?.appearances)}</td><td>${number(p.stats?.goals)}</td><td>${p.stats?.avg_rating!=null?Number(p.stats.avg_rating).toFixed(1):'—'}</td><td><span class="roster-status-dot ${active(p)?'active':'inactive'}" title="${active(p)?'In rosa oggi':'Non attivo oggi'}" aria-label="${active(p)?'In rosa oggi':'Non attivo oggi'}"></span></td></tr>`).join('')}</tbody></table></div>`;
 return `${heading('I PROTAGONISTI','La rosa','Giocatori della stagione selezionata, con dati collegati al profilo originale.')}<div class="filters roster-filters"><div class="segmented">${[['all','Tutti'],['P','Portieri'],['D','Difensori'],['C','Centrocampisti'],['A','Attaccanti']].map(([k,l])=>`<button data-role="${k}" class="${state.role===k?'active':''}">${l}</button>`).join('')}</div><div class="roster-tools"><label class="local-search">${ico('search',18)}<input id="player-search" placeholder="Cerca giocatore" value="${E(state.q)}" aria-label="Cerca giocatore"></label>${isStaff(staffContext())?'<button class="roster-add" type="button" data-roster-new>+ Nuovo</button>':''}</div></div>${table}${shown.length===0?'<p class="muted small" id="roster-empty">Nessun giocatore corrisponde ai filtri.</p>':''}`;
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
 return `${heading('DATA & PERFORMANCE','Statistiche','Numeri stagionali ricostruiti da risultati, tabellini ed eventi registrati.')}${eventAnalyticsPlaceholder()}`;
}
function resolveMatch(){const f=fixtures().find(x=>x.id===state.match);const exact=state.data?.matches?.find(m=>m.fixture_id===f?.id);return {fixture:f,operational:f?(exact||fixtureToMatch(f,state.data?.matches||[],state.base.opponents,team())):null}}
function staffContext(){return {state,heading,resolveMatch,loadMatchInfo,involvesTeam,render,toast,reloadAll,refreshLive,logoutUser}}
function admin(){return adminPage(staffContext())}
function matchEventTimeline(events,fixture,playerName,ourTeam,competitionSettings,trustedReviewer=false,match=null,adminEdit=false){
 const norm=v=>String(v??'').trim().toLocaleLowerCase('it');
 const homeIsOurs=Boolean(ourTeam?.id&&fixture.home_team_id===ourTeam.id);
 const side=e=>{const s=norm(e.team_side||e.side);if(['home','casa'].includes(s))return 'home';if(['away','ospite'].includes(s))return 'away';if(['team','ours','own'].includes(s))return homeIsOurs?'home':'away';if(['opponent','opposition'].includes(s))return homeIsOurs?'away':'home';return 'unknown'};
 const type=e=>norm(e.event_type);
 const goal=e=>['goal','penalty_goal','penalty_scored','own_goal'].includes(type(e));
 const configuredMinutes=Number(competitionSettings?.minutes_per_period);
 const duration=Number.isFinite(configuredMinutes)&&configuredMinutes>0?configuredMinutes:null;
 const absoluteMinute=e=>cumulativeEventMinute(e,competitionSettings);
 const periodNo=e=>{
  if(norm(e.payload?.period)==='halftime')return 2;
  const explicit=Number(e.payload?.period_no);
  if(Number.isInteger(explicit)&&explicit>0)return explicit;
  const p=norm(e.payload?.period);if(p==='first_half')return 1;if(p==='second_half')return 2;
  const minute=absoluteMinute(e);
  return duration!==null&&minute!==null?Math.max(1,Math.ceil(Math.max(1,minute)/duration)):1;
 };
 const recovery=e=>Math.max(0,Number(e.stoppage_minute)||0);
 const order=e=>{const n=absoluteMinute(e);return n===null?Infinity:n+recovery(e)/100};
 const periodEnds=[...(events||[])].filter(e=>type(e)==='period_end'&&e.validation_status!=='rejected');
 const raw=[...(events||[])].filter(e=>type(e)!=='period_end'&&e.validation_status!=='rejected');
 const ordered=raw.sort((a,b)=>order(a)-order(b)||String(a.created_at||'').localeCompare(String(b.created_at||'')));
 let home=0,away=0;
 const tracked=ordered.map(e=>{const counts=!['rejected','disputed'].includes(e.validation_status)&&e.payload?.count_score!==false;if(counts&&goal(e)){let s=side(e);if(type(e)==='own_goal')s=s==='home'?'away':s==='away'?'home':'unknown';if(s==='home')home++;if(s==='away')away++;}const saved=e.payload?.legacy_fixture_score;const snapshot=Number.isInteger(saved?.home)&&Number.isInteger(saved?.away)?saved:null;return {event:e,score:counts&&goal(e)?(snapshot?snapshot.home+' - '+snapshot.away:home+' - '+away):null}});
 const heading=(label,kind='period')=>'<div class="mt-divider mt-divider-'+E(kind)+'"><span>'+E(label)+'</span>'+(adminEdit&&kind==='title'?'<button type="button" class="mt-title-add" data-timeline-add aria-label="Aggiungi evento">+</button>':'')+'</div>';
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
  const sanction=history.at(-1)==='blue_card'?'blue':'yellow';
  const colors=cumulative?[sanction,'red']:[t==='red_card'?'red':t==='blue_card'?'blue':'yellow'];
  if(cumulative&&colors.length===1)colors.unshift('yellow');
  return '<span class="mt-card-stack" aria-label="Cartellino">'+colors.map(c=>'<i class="mt-card-'+c+'"></i>').join('')+'</span>';
 };
 const icon=e=>{const t=type(e);if(goal(e))return '';if(['yellow_card','red_card','blue_card','second_yellow'].includes(t))return cards(e);if(['substitution','sub_out','sub_in'].includes(t))return '<span class="mt-change" aria-label="Sostituzione"><span class="mt-sub-in">→</span><span class="mt-sub-out">←</span></span>';if(t==='blue_return')return '<span class="mt-generic">↩</span>';return '<span class="mt-generic">◆</span>'};
 const eventState=e=>!e.validation_status||e.validation_status==='official'?'official':e.validation_status==='disputed'?'disputed':'pending';
 const timingInfo=e=>{
  if(e.minute==null)return '<small class="mt-event-meta">Evento passato · timestamp salvato, minuto da completare</small>';
  if(e.payload?.minute_provisional===true)return '<small class="mt-event-meta timing-provisional">Minuto provvisorio stimato dall’orario di inizio</small>';
  const delta=Number(e.timing_delta_seconds);
  if(e.timing_consistent===false&&Number.isFinite(delta)){
   const minutes=Math.max(1,Math.round(Math.abs(delta)/60));
   return '<small class="mt-event-meta timing-warning">Inserito '+minutes+' min '+(delta>0?'dopo':'prima')+' rispetto al minutaggio</small>';
  }
  return '';
 };
 const eventContent=entry=>{const e=entry.event,t=type(e),isChange=['substitution','sub_out','sub_in'].includes(t);
  const primary=isChange&&e.secondary_player_id?playerName(e.secondary_player_id):e.player_id?playerName(e.player_id):goal(e)?'Gol avversario':e.payload?.opponent_shirt_number?'#'+e.payload.opponent_shirt_number:'Squadra';
  const secondary=isChange?(e.secondary_player_id&&e.player_id?playerName(e.player_id):''):(goal(e)&&e.secondary_player_id?playerName(e.secondary_player_id):'');
  const score=entry.score?'<span class="mt-score">'+E(entry.score)+'</span>':'';
  const names='<span class="mt-names"><strong>'+E(primary)+'</strong>'+(secondary?'<small>'+E(secondary)+'</small>':'')+'</span>';
  return (goal(e)?'':'<span class="mt-icon">'+icon(e)+'</span>')+score+names;
 };
 const minutes=e=>E(displayEventMinute(e,competitionSettings).replace('′',"'"));
 const recoveryByPeriod=new Map(),declaredRecoveryByPeriod=new Set(),periodEndByPeriod=new Map();
 for(const e of periodEnds){
  const p=periodNo(e);
  const declared=Number(e.payload?.recovery_declared)||0;
  const n=Number(e.payload?.recovery_minutes??e.stoppage_minute)||0;
  if(declared>0)declaredRecoveryByPeriod.add(p);
  recoveryByPeriod.set(p,n);
  if(!periodEndByPeriod.has(p)||String(periodEndByPeriod.get(p).created_at||'')<String(e.created_at||''))periodEndByPeriod.set(p,e);
 }
 const liveRecoveryPeriod=Math.max(1,Number(match?.live_recovery_period_no||0));
 const liveRecovery=Number(match?.live_recovery_minutes)||0;
 if(match?.status==='live'&&liveRecoveryPeriod>0&&liveRecovery>0){
  recoveryByPeriod.set(liveRecoveryPeriod,liveRecovery);
  declaredRecoveryByPeriod.add(liveRecoveryPeriod);
 }
 for(const e of ordered){
  if(recovery(e)){
   const p=periodNo(e);
   if(!declaredRecoveryByPeriod.has(p))recoveryByPeriod.set(p,Math.max(recovery(e),recoveryByPeriod.get(p)||0));
  }
 }
 const halfGoals=tracked.filter(x=>periodNo(x.event)===1&&!['rejected','disputed'].includes(x.event.validation_status)&&x.event.payload?.count_score!==false&&goal(x.event));
 const halfEnd=periodEndByPeriod.get(1);
 const halfScore=Number.isInteger(Number(halfEnd?.payload?.score_home))&&Number.isInteger(Number(halfEnd?.payload?.score_away))?
  Number(halfEnd.payload.score_home)+' - '+Number(halfEnd.payload.score_away):
  halfGoals.some(x=>absoluteMinute(x.event)===null)?'? - ?':
  halfGoals.reduce((scores,x)=>{let s=side(x.event);if(type(x.event)==='own_goal')s=s==='home'?'away':s==='away'?'home':'unknown';if(s==='home')scores[0]++;if(s==='away')scores[1]++;return scores},[0,0]).join(' - ');
 const complete=['finished','completed','full_time','ft'].includes(norm(fixture.status));
 const maxPeriod=Math.max(1,...tracked.map(x=>periodNo(x.event)),...Array.from(recoveryByPeriod.keys()).map(Number));
 const descending=[...tracked].reverse();
 const sameMoment=(a,b)=>periodNo(a.event)===periodNo(b.event)&&absoluteMinute(a.event)===absoluteMinute(b.event)&&recovery(a.event)===recovery(b.event);
 const groupedRows=items=>{
  let output='';
  for(let i=0;i<items.length;){
   let j=i+1;while(j<items.length&&sameMoment(items[i],items[j]))j++;
   const group=items.slice(i,j),first=group[0].event;
   const contentFor=which=>group.filter(x=>side(x.event)===which||(which==='away'&&side(x.event)==='unknown'))
    .map(x=>adminEdit&&x.event.id?
     '<button type="button" class="mt-group-item mt-editable-event" data-timeline-event="'+E(x.event.id)+'" title="Modifica evento">'+eventContent(x)+'</button>':
     '<div class="mt-group-item">'+eventContent(x)+'</div>').join('');
   output+='<div class="mt-row'+(group.length>1?' mt-minute-group':'')+'"><div class="mt-side mt-home"><div class="mt-stack">'+contentFor('home')+'</div></div><b class="mt-minute">'+minutes(first)+'</b><div class="mt-side mt-away"><div class="mt-stack">'+contentFor('away')+'</div></div></div>';
   i=j;
  }
  return output;
 };
 const renderPeriod=p=>{
  const entries=descending.filter(x=>periodNo(x.event)===p);
  const base=duration===null?null:p*duration;
  const added=x=>{const n=absoluteMinute(x.event);return recovery(x.event)>0||(base!==null&&n!==null&&n>=base)};
  const stoppage=entries.filter(added),regular=entries.filter(x=>!added(x));
  const declared=Number(recoveryByPeriod.get(p))||0,endEvent=periodEndByPeriod.get(p);
  let output='';
  if(endEvent&&!(complete&&p===maxPeriod)){
   const label=String(endEvent.payload?.label||(p===1?'HT':'FINE '+p+'° TEMPO'));
   const scoreHome=Number(endEvent.payload?.score_home),scoreAway=Number(endEvent.payload?.score_away);
   const scoreText=Number.isFinite(scoreHome)&&Number.isFinite(scoreAway)?
    scoreHome+' - '+scoreAway:(p===1?halfScore:'');
   output+=heading(label+(scoreText?' '+scoreText:''));
  }
  output+=groupedRows(stoppage);
  if(declared>0||stoppage.length)output+=heading(declared>0?'RECUPERO +'+E(declared)+"'":'RECUPERO','recovery');
  return output+groupedRows(regular);
 };
 let parts=heading(complete?'FT '+E(fixture.home_score??home)+' - '+E(fixture.away_score??away):'EVENTI','title');
 if(maxPeriod===2){
  parts+=renderPeriod(2)+(periodEndByPeriod.has(1)?'':heading('HT '+halfScore))+renderPeriod(1);
 }else if(maxPeriod>2){
  for(let p=maxPeriod;p>=1;p--){
   parts+=renderPeriod(p);
   if(p>1)parts+=heading('FINE '+(p-1)+'° TEMPO');
  }
 }else parts+=renderPeriod(1);
 return '<div class="match-timeline'+(adminEdit?' is-admin-editable':'')+'" aria-label="Cronologia eventi della partita">'+
  (tracked.length||recoveryByPeriod.size?parts:parts+'<div class="empty padded">Nessun evento registrato.</div>')+'</div>';
}

function matchRules(m,comp){
 return {...(comp||{}),
  periods:Number(m?.periods_override||comp?.periods||2),
  minutes_per_period:Number(m?.minutes_per_period_override||comp?.minutes_per_period||40),
  rolling_substitutions:Boolean(m?.rolling_substitutions)};
}
function timelineEventEditor(){
 const edit=state.timelineEditor;if(!edit||state.identity?.role?.role!=='admin')return '';
 const {fixture:f,operational:m}=resolveMatch();if(!f)return '';
 const fixtureOnly=!m;
 const source=fixtureOnly?(state.fixtureEvents||[]):((state.matchData?.events)||[]);
 const ev=edit.eventId?source.find(x=>String(x.id)===String(edit.eventId)):null;
 const sideValue=ev?.team_side||ev?.side||(fixtureOnly?'home':'team');
 const minute=ev?.minute??edit.minute??'';
 const stoppage=ev?.stoppage_minute??edit.stoppage??0;
 const periodValue=ev?.payload?.period||((Number(minute)>=Number(matchRules(m,competition(f.competition_id))?.minutes_per_period||40))?'second_half':'first_half');
 const people=state.data?.players||[];
 const playerOptions='<option value="">—</option>'+people.map(p=>'<option value="'+E(p.id)+'" '+(ev?.player_id===p.id?'selected':'')+'>'+E(matchPlayerLabel(p))+'</option>').join('');
 const secondaryOptions='<option value="">—</option>'+people.map(p=>'<option value="'+E(p.id)+'" '+(ev?.secondary_player_id===p.id?'selected':'')+'>'+E(matchPlayerLabel(p))+'</option>').join('');
 const types=[['goal','Gol'],['own_goal','Autogol'],['penalty_scored','Rigore segnato'],['penalty_missed','Rigore sbagliato'],['yellow_card','Giallo'],['blue_card','Blu'],['red_card','Rosso'],['substitution','Cambio'],['assist','Assist'],['other','Altro']];
 const sideOptions=fixtureOnly?[['home','Casa'],['away','Ospiti']]:[['team','Nostra squadra'],['opponent','Avversario']];
 return '<div class="live-sheet-backdrop timeline-editor-backdrop" data-timeline-close><section class="live-event-sheet timeline-event-sheet" role="dialog" aria-modal="true" aria-label="'+(ev?'Modifica evento':'Aggiungi evento')+'">'+
  '<div class="live-sheet-handle"></div><div class="live-sheet-head"><div><small>TIMELINE</small><h3>'+(ev?'Modifica evento':'Aggiungi evento')+'</h3></div><button type="button" data-timeline-close aria-label="Chiudi">×</button></div>'+
  '<form data-timeline-event-form class="staff-form live-sheet-form" data-event-id="'+E(ev?.id||'')+'" data-fixture-only="'+fixtureOnly+'">'+
   '<div class="live-sheet-grid"><label class="staff-field"><span>Tipo</span><select name="event_type">'+types.map(([k,l])=>'<option value="'+k+'" '+((ev?.event_type||'goal')===k?'selected':'')+'>'+l+'</option>').join('')+'</select></label>'+
   '<label class="staff-field"><span>Squadra</span><select name="team_side">'+sideOptions.map(([k,l])=>'<option value="'+k+'" '+(sideValue===k?'selected':'')+'>'+l+'</option>').join('')+'</select></label>'+
   '<label class="staff-field"><span>Periodo</span><select name="period"><option value="first_half" '+(periodValue==='first_half'?'selected':'')+'>1° tempo</option><option value="halftime" '+(periodValue==='halftime'?'selected':'')+'>Intervallo</option><option value="second_half" '+(periodValue==='second_half'?'selected':'')+'>2° tempo</option><option value="extra" '+(periodValue==='extra'?'selected':'')+'>Supplementari</option></select></label>'+
   '<label class="staff-field"><span>Minuto</span><input name="minute" inputmode="numeric" type="number" min="0" max="300" value="'+E(minute)+'"></label>'+
   '<label class="staff-field"><span>Recupero</span><input name="stoppage_minute" inputmode="numeric" type="number" min="0" max="30" value="'+E(stoppage)+'"></label>'+
   (!fixtureOnly?'<label class="staff-field"><span>Giocatore</span><select name="player_id">'+playerOptions+'</select></label><label class="staff-field"><span>Secondo giocatore</span><select name="secondary_player_id">'+secondaryOptions+'</select></label>':'')+
   '<label class="staff-field live-notes"><span>Note</span><input name="notes" maxlength="400" value="'+E(ev?.payload?.notes||ev?.notes||'')+'"></label></div>'+
   '<div class="live-sheet-actions">'+
    (ev?'<button type="button" class="staff-danger" data-timeline-delete="'+E(ev.id)+'">Elimina</button>':'')+
    '<button type="button" class="staff-soft" data-timeline-close>Annulla</button><button type="submit" class="staff-submit">'+(ev?'Salva modifiche':'Aggiungi evento')+'</button></div>'+
  '</form></section></div>';
}
function match(){
 const {fixture:f,operational:m}=resolveMatch();if(!f)return '<section class="empty">Partita non disponibile.</section>';
 const data=state.matchData||{players:[],events:[],ratings:[],ratingMeans:[]};
 const comp=competition(f.competition_id);
 const rules=matchRules(m,comp);
 const people=id=>(state.data?.players||[]).find(p=>p.id===id);
 const playerName=id=>matchPlayerLabel(people(id));
 const activeEvents=(data.events||[]).filter(e=>e.validation_status!=='rejected');
 const pending=activeEvents.filter(e=>['proposed','community_confirmed','disputed'].includes(e.validation_status)).length;
 const adminTimeline=state.identity?.role?.role==='admin'&&state.scoreEditing;
 const timeline=m?matchEventTimeline(activeEvents,f,playerName,team(),rules,['admin','player'].includes(state.identity?.role?.role),m,adminTimeline):
  matchEventTimeline(state.fixtureEvents||[],f,playerName,team(),rules,false,null,adminTimeline);
 const extraMatch=!involvesTeam(f,team());
 const availableKits=collectionForClub(team()||{});
 const activeKit=availableKits[m?.match_kit_key]||availableKits.home||Object.values(availableKits)[0];
 const formation=m?overviewLineup(m,data,state.data?.players||[],state.data?.playerStats||[],comp,activeKit):
  '<div class="empty">Formazione non disponibile: partita senza tabellino operativo.</div>';
 const staffAccess=isStaff(staffContext());
 const matchIsLive=m?.status==='live'||f.status==='live';
 const kickoffMs=Date.parse(f.kickoff_at||'');
 const liveEntryOpen=matchIsLive||(m?.status==='scheduled'&&Number.isFinite(kickoffMs)&&Date.now()>=kickoffMs-5*60000);
 const canLiveContribute=Boolean(state.identity?.user)&&!extraMatch&&Boolean(m)&&liveEntryOpen;
 const tabs=extraMatch?[['info','Info'],['overview','Overview'],...(staffAccess?[['verification','Verifica / rettifica']]:[]) ]:[['info','Info'],...(staffAccess?[['callups','Disponibilità']]:[]),['ratings','Voti'],...(canLiveContribute?[['live','Live']]:[]),['overview','Overview'],['lineup','Formazione'],['events','Eventi'],...(staffAccess?[['verification','Verifica / rettifica'],['tactics','Tattica']]:[])];
 const requestedTab=state.matchTab==='summary'?'overview':state.matchTab;
 const mappedTab=requestedTab==='staff'?(staffAccess&&!extraMatch?'callups':'overview'):requestedTab;
 const selectedTab=tabs.some(([id])=>id===mappedTab)?mappedTab:'overview';
 const titleInfo=(label,value)=>value?'<span class="match-meta-item" title="'+E(label)+'"><small class="sr-only">'+E(label)+'</small><strong>'+E(value)+'</strong></span>':'';
 const {name:venue,address}=fixtureVenueDetails(f,fixtureHomeClub(f));
 const editor=false; // Modifica metadati esclusivamente nella scheda Info
 const field=(name,label,value)=>'<label class="extra-meta-field">'+label+'<input data-extra-field="'+name+'" aria-label="'+label+'" value="'+E(value??'')+'"></label>';
 const placeLink=address?'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(address):'';
 const matchMeta='<div class="match-header-footer-meta" aria-label="Dettagli partita">'+
  '<span class="match-footer-item match-footer-competition">'+ico('trophy',15)+'<strong>'+E((comp?.name||'—')+(f.round_no!=null?' · Giornata '+f.round_no:''))+'</strong></span>'+
  (placeLink?'<a class="match-footer-item match-footer-venue" target="_blank" rel="noopener noreferrer" href="'+E(placeLink)+'" title="Apri il luogo su Maps">'+ico('pin',15)+'<strong>'+E(venue||address||'—')+'</strong></a>':'<span class="match-footer-item match-footer-venue">'+ico('pin',15)+'<strong>'+E(venue||'—')+'</strong></span>')+
  '</div>';
 const scorers=matchScorerRows(activeEvents.filter(e=>['official','proposed','community_confirmed'].includes(e.validation_status)),f,team(),playerName,rules);
 const recordedGoals=(state.fixtureEvents||[]).filter(e=>e.validation_status!=='rejected'&&['goal','penalty_goal','penalty_scored','own_goal'].includes(e.event_type));
 const eventGoals=recordedGoals.reduce((a,e)=>{const side=e.event_type==='own_goal'?(e.side==='home'?'away':'home'):e.side;if(side==='home')a.home++;if(side==='away')a.away++;return a},{home:0,away:0});
 const scoreMismatch=extraMatch&&hasScore(f)&&(eventGoals.home!==Number(f.home_score)||eventGoals.away!==Number(f.away_score));
 const officialHome=Number.isInteger(f.home_score)?Number(f.home_score):0,officialAway=Number.isInteger(f.away_score)?Number(f.away_score):0;
 const pendingGoals=activeEvents.filter(e=>['proposed','community_confirmed'].includes(e.validation_status)&&e.payload?.count_score!==false&&['goal','penalty_goal','penalty_scored','own_goal'].includes(e.event_type));
 const proposedScore=pendingGoals.reduce((score,e)=>{
  let home=(m?.home_away==='home'&&e.team_side==='team')||(m?.home_away==='away'&&e.team_side==='opponent');
  if(e.event_type==='own_goal')home=!home;
  if(home)score.home++;else score.away++;
  return score;
 },{home:officialHome,away:officialAway});
 const hasProposedScore=Boolean(liveEntryOpen&&pendingGoals.length);
 const scoreText=hasProposedScore?
  E(proposedScore.home)+' <span class="match-score-separator" aria-hidden="true">-</span> '+E(proposedScore.away):
  hasScore(f)?E(f.home_score)+' <span class="match-score-separator" aria-hidden="true">-</span> '+E(f.away_score):'<span class="vs">VS</span>';
 const editableScore=state.identity?.role?.role==='admin';
 const scoreInner=liveEntryOpen?'<span class="match-score-trigger '+(hasProposedScore?'score-proposed':'score-pending')+'">'+scoreText+(hasProposedScore?'<small class="match-proposed-label">PROVVISORIO</small>':'')+'</span>':scoreText;
 const headerScore=editableScore?'<button type="button" class="match-score-edit-toggle'+(state.scoreEditing?' is-editing':'')+'" data-score-edit aria-pressed="'+state.scoreEditing+'" title="'+(state.scoreEditing?'Esci dalla modifica eventi':'Modifica eventi')+'">'+scoreInner+'</button>':scoreInner;
 const livePeriodLabel=m?.live_period==='halftime'?'Intervallo':m?.live_period==='penalties'?'Rigori':
  (m?.status==='live'?(Math.max(1,Number(m?.live_period_no||1))+'° tempo'):'');
 const liveRecovery=(m?.status==='live'&&Number(m?.live_recovery_period_no)===Math.max(1,Number(m?.live_period_no||1)))?Number(m?.live_recovery_minutes||0):0;
 const liveClockBase=Number(m?.live_clock_seconds||0),liveClockAnchor=Date.parse(m?.live_clock_anchor||'');
 const liveClockNow=Math.max(0,liveClockBase+(m?.live_clock_running&&Number.isFinite(liveClockAnchor)?Math.floor((Date.now()-liveClockAnchor)/1000):0));
 const liveClockText=String(Math.floor(liveClockNow/60)).padStart(2,'0')+':'+String(liveClockNow%60).padStart(2,'0');
 if(m?.id&&state.matchData){
  const value=weightedTeamRating({match:m,matchPlayers:data.players||[],events:data.events||[],ratings:data.ratings||[],competition:rules});
  teamRatingCache.set(String(m.id),Number.isFinite(value)?value:null);
 }
 const weighted=weightedScoreBadge(m?.id);
 const homeWeighted=f.home_team_id===team()?.id?weighted:'';
 const awayWeighted=f.away_team_id===team()?.id?weighted:'';
 const headerTimer=m&&m.status==='live'?
  (m.live_period==='halftime'?
   '<div class="match-header-live-clock match-header-interval"><small>Intervallo</small></div>':
   '<div class="match-header-live-clock"><strong data-staff-clock data-seconds="'+Number(m.live_clock_seconds||0)+'" data-anchor="'+E(m.live_clock_anchor||'')+'" data-running="'+Boolean(m.live_clock_running)+'" data-match="'+E(m.id)+'" data-blue-min="'+Number(comp?.discipline_rules?.blue_duration_minutes||0)+'" data-period-len="'+Number(rules?.minutes_per_period||0)+'" data-period-no="'+Math.max(1,Number(m.live_period_no||1))+'">'+E(liveClockText)+'</strong>'+
   '<small data-staff-period-label data-base-label="'+E(livePeriodLabel)+'" data-recovery="'+E(liveRecovery)+'">'+E(livePeriodLabel)+'</small></div>'):'';
 const compactHeader='<div class="match-compact-bar glass'+(matchIsLive?' is-live':'')+'" aria-hidden="true">'+
  (matchIsLive?'':('<div class="match-compact-club match-compact-home">'+teamCrestWithWeighted(f.home_team,'sm',{team_id:f.home_team_id,opponent_id:f.home_opponent_id},homeWeighted,'home')+
  teamNameWithWeighted(f.home_team)+'</div>'))+
  '<div class="match-compact-center"><b class="match-compact-score">'+headerScore+'</b>'+headerTimer+'</div>'+
  (matchIsLive?'':('<div class="match-compact-club match-compact-away">'+teamNameWithWeighted(f.away_team)+
  teamCrestWithWeighted(f.away_team,'sm',{team_id:f.away_team_id,opponent_id:f.away_opponent_id},awayWeighted,'away')+'</div>'))+'</div>';
 const statusEditor=editor?'<select data-extra-status aria-label="Stato partita">'+[['scheduled','Programmato'],['live','Live'],['finished','Finale'],['postponed','Rinviata'],['suspended','Sospesa'],['cancelled','Annullata']].map(([key,text])=>'<option value="'+key+'"'+(f.status===key?' selected':'')+'>'+text+'</option>').join('')+'</select>':null;
 const testNotice=f.is_test?'<div class="match-test-banner"><strong>TEST PRIVATO</strong> · solo tuo · '+E(rules.periods)+'×'+E(rules.minutes_per_period)+"'"+' · cambi '+(rules.rolling_substitutions?'rotanti':'non rotanti')+' · escluso da classifiche e statistiche</div>':'';
 const header=testNotice+'<div class="match-detail-head glass">'+
  '<div class="match-expanded">'+
  '<div class="match-detail-score"><div class="match-header-team match-header-team-home">'+teamCrestWithWeighted(f.home_team,'xl',{team_id:f.home_team_id,opponent_id:f.home_opponent_id},homeWeighted,'home')+
  teamNameWithWeighted(f.home_team)+renderMatchScorers(scorers,'home',E)+'</div>'+
  '<div class="match-big-score"><div class="match-score-datetime">'+E(shortDate(f.kickoff_at))+' '+E(time(f.kickoff_at))+'</div><div class="match-score-status">'+(statusEditor||status(f))+'</div><b>'+headerScore+'</b>'+headerTimer+'</div>'+
  '<div class="match-header-team match-header-team-away">'+teamCrestWithWeighted(f.away_team,'xl',{team_id:f.away_team_id,opponent_id:f.away_opponent_id},awayWeighted,'away')+
  teamNameWithWeighted(f.away_team)+renderMatchScorers(scorers,'away',E)+'</div></div>'+matchMeta+'</div>'+
  '</div>';
 const resultStatus=f.status==='finished'&&m?(m.result_review_status==='confirmed'?'Risultato confermato':'Risultato in attesa di conferma'):'';
 const notice=(pending?'<p class="data-warning">'+pending+' eventi ancora da ufficializzare.</p>':'')+
  (resultStatus&&selectedTab==='info'?'<p class="staff-help">'+E(resultStatus)+'</p>':'');
 const canEditInfo=state.identity?.role?.role==='admin';
 const infoField=(key,label,value)=>'<label class="staff-field"><span>'+label+'</span><input data-extra-field="'+key+'" aria-label="'+label+'" value="'+E(value??'')+'" '+(canEditInfo?'':'disabled')+'></label>';
 const kitSelect=staffAccess&&!extraMatch&&m?'<div class="match-kit-chooser"><span>Maglia utilizzata</span><div class="match-kit-grid">'+
  Object.entries(availableKits).map(([key,kit],i)=>'<button type="button" class="match-kit-choice" data-match-kit-choice="'+E(key)+'" aria-pressed="'+((m.match_kit_key||Object.keys(availableKits)[0])===key)+'">'+
   shirtSvg(kit,'matchkit-'+i,false)+'<strong>'+E(kit.name||key)+'</strong></button>').join('')+
  '</div><p class="match-kit-caption">La scelta viene salvata per questa partita e utilizzata sul campo nelle schede Formazione e Overview.</p></div>':'';
 const reviewAction=canEditInfo&&m&&f.status==='finished'&&m.status==='finished'&&!extraMatch?
  (m.result_review_status==='confirmed'?'<div class="match-result-decision"><strong>Risultato ufficiale confermato</strong><button type="button" class="staff-soft" data-staff-action="review-result-reopen">Riapri verifica</button></div>':
  '<div class="match-result-decision"><strong>Risultato in attesa di conferma</strong>'+(pending?'<small>Prima ufficializza i '+pending+' eventi in sospeso dalla scheda Eventi.</small>':'')+
  '<button type="button" class="staff-submit" data-staff-action="review-result-confirm"'+(pending?' disabled title="Ufficializza prima gli eventi"':'')+'>Conferma risultato</button></div>'):'';
 const infoContent='<div class="match-info-editor">'+reviewAction+
  '<div class="staff-form-grid">'+infoField('kickoff_at','Data e ora',f.kickoff_at?new Date(f.kickoff_at).toISOString().slice(0,16):'')+
  infoField('venue_name','Campo',f.venue_name||venue)+infoField('venue_address','Indirizzo',f.venue_address||address)+
  (canEditInfo?'<label class="staff-field"><span>Stato</span><select data-extra-status>'+[['scheduled','Programmato'],['live','Live'],['finished','Finale'],['postponed','Rinviata'],['suspended','Sospesa'],['cancelled','Annullata']].map(([key,name])=>'<option value="'+key+'"'+(f.status===key?' selected':'')+'>'+name+'</option>').join('')+'</select></label>':'')+
  kitSelect+'</div></div>';
 let body='';
 if(selectedTab==='info')body=infoContent;
 else if((staffAccess||selectedTab==='live')&&['live','callups','tactics'].includes(selectedTab))body=staffMatchSection(staffContext(),f,m,selectedTab);
 else if(selectedTab==='events')body=staffAccess&&!extraMatch?staffMatchSection(staffContext(),f,m,'events'):'<div class="inner-card"><h3>Cronologia eventi</h3>'+timeline+'</div>';
 else if(selectedTab==='verification')body=staffAccess?staffMatchSection(staffContext(),f,m,'verification'):'<div class="empty">Verifica riservata allo staff.</div>';
 else if(selectedTab==='lineup')body=isStaff(staffContext())&&m?matchLineup(staffContext(),m):'<div class="inner-card">'+formation+'</div>';
 else if(selectedTab==='ratings')body=votesPanel({match:m,data,people:state.data?.players||[],userId:state.identity.user,loggedIn:hasSession(),escape:E,competition:comp,kit:activeKit});
 else {
  const prediction=preMatchPredictionContainer(f,E);
  const preMatch=['scheduled','postponed'].includes(String(f.status||''))&&!extraMatch;
  if(preMatch)body='<div class="prematch-overview-grid"><div class="prematch-overview-left">'+prediction+'</div>'+
   '<aside class="glass prematch-lineup-panel" data-prematch-lineup="'+E(f.id)+'"><div class="prematch-loading"><span class="loader"></span><span>Calcolo formazione ipotetica…</span></div></aside></div>';
  else body=prediction+(extraMatch?'<div class="inner-card match-overview-events"><h3>Eventi</h3>'+timeline+'</div>':'<div class="match-overview-grid"><div class="inner-card match-overview-events"><h3>Eventi</h3>'+timeline+
   '</div><div class="inner-card match-overview-formation">'+formation+'</div></div>');
 }
 return '<button class="back-link" data-page="calendar">'+ico('back')+' Torna al calendario</button>'+
  '<div class="match-header-sentinel" aria-hidden="true"></div>'+header+compactHeader+'<section class="glass panel detail-panel"><div class="tab-scroll" role="tablist" aria-label="Dettaglio partita">'+
  tabs.map(([id,label])=>'<button role="tab" aria-selected="'+(selectedTab===id)+'" data-tab="'+id+
   '" class="'+(selectedTab===id?'active':'')+'">'+label+'</button>').join('')+
  '</div><div class="match-tab-body">'+notice+body+(selectedTab==='lineup'?
  tacticalHistory(data.tacticalChanges||[],state.data?.players||[]):'')+'</div></section>'+timelineEventEditor();
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
 if(state.overlay==='login')return `<div class="overlay" data-dismiss><section class="overlay-card" role="dialog" aria-modal="true" aria-label="Accedi"><button class="close-overlay" data-action="close" aria-label="Chiudi">${ico('close')}</button><span class="eyebrow">AREA RISERVATA</span><h2>Bentornato in squadra.</h2><p>Accedi con le credenziali già configurate. Se sei un giocatore non ancora registrato, inserisci <b>nome.cognome</b> e scegli una password: il profilo verrà creato e collegato automaticamente.</p><form id="login-form"><label>Username<input name="username" autocomplete="username" required placeholder="Il tuo username"></label><label>Password<input name="password" type="password" autocomplete="current-password" required placeholder="••••••••"></label><div id="login-error" class="form-error" aria-live="polite"></div><button type="submit" class="primary-btn">Accedi ${ico('arrow',17)}</button><button type="button" data-account-recover class="account-recover">Password dimenticata?</button></form></section></div>`;
 if(state.overlay==='menu')return `<div class="overlay" data-dismiss><section class="overlay-card menu-sheet" role="dialog" aria-modal="true" aria-label="Menu"><button class="close-overlay" data-action="close" aria-label="Chiudi">${ico('close')}</button><h2>Esplora Team Manager</h2><label class="season-box dark"><span>Stagione</span><select data-season>${state.base.seasons.map(s=>`<option value="${E(s.id)}" ${s.id===state.season?'selected':''}>${E(s.name)}</option>`).join('')}</select></label>${nav.map(([id,ic,l])=>`<button class="menu-link" data-page="${id}">${ico(ic)} ${l} ${ico('chevron',16)}</button>`).join('')}<button class="menu-link" data-page="club">${ico('settings')} Squadra e avversarie ${ico('chevron',16)}</button>${isStaff(staffContext())?`<button class="menu-link" data-page="admin">${ico('settings')} Amministrazione ${ico('chevron',16)}</button>`:''}<button class="menu-link" data-page="account">${ico('user')} Profilo ${ico('chevron',16)}</button></section></div>`;
 if(state.overlay==='new-test-match'){
  const opponents=(state.base?.opponents||[]).slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'it'));
  const now=new Date(Date.now()+5*60000),local=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,16);
  return `<div class="overlay" data-dismiss><section class="overlay-card calendar-new-sheet" role="dialog" aria-modal="true" aria-label="Nuova amichevole o test"><button class="close-overlay" data-action="close" aria-label="Chiudi">${ico('close')}</button><span class="eyebrow">CALENDARIO</span><h2>Nuova amichevole / test</h2><p>Partita privata visibile solo al tuo account e esclusa dalle statistiche ufficiali.</p><form id="private-match-form" class="calendar-new-form"><label>Avversaria<select name="opponent_id" required><option value="">Seleziona</option>${opponents.map(o=>`<option value="${E(o.id)}">${E(o.name)}</option>`).join('')}</select></label><label>Casa / trasferta<select name="home_away"><option value="home">Casa</option><option value="away">Trasferta</option></select></label><label>Data e ora inizio<input name="kickoff_at" type="datetime-local" value="${E(local)}" required></label><label>Luogo<input name="venue_name" placeholder="Campo / impianto"></label><div class="calendar-rule-grid"><label>Numero tempi<input name="periods" type="number" min="1" max="6" value="2" required></label><label>Durata per tempo<input name="minutes_per_period" type="number" min="1" max="120" value="40" required></label></div><label class="staff-check calendar-rolling"><input type="checkbox" name="rolling_substitutions"> Cambi rotanti <small>un giocatore uscito può rientrare</small></label><div id="private-match-error" class="form-error" aria-live="polite"></div><button type="submit" class="primary-btn">Crea partita ${ico('arrow',17)}</button></form></section></div>`;
 }
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
 document.body.dataset.live=liveFixture()?'true':'false';
 document.body.dataset.currentMatchLive=currentMatchIsLive()?'true':'false';
 document.body.dataset.matchHeaderMode=currentMatchIsLive()?'live-compact':'default';
 $('#app').innerHTML=`<div class="ambient ambient-a"></div><div class="ambient ambient-b"></div><div class="shell">${sidebar()}<div class="workspace">${header()}${currentMatchIsLive()?'':liveScoreHeader()}<main class="content" id="main">${state.loading?`<div class="loading-state"><div class="loader"></div>Caricamento dati stagione…</div>`:section()}${!state.loading&&Object.keys(state.data?.errors||{}).length?`<div class="data-warning">Alcune sezioni non sono accessibili al profilo attuale: ${E(Object.keys(state.data.errors).join(', '))}.</div>`:''}</main><footer class="footer">TEAM MANAGER <span>·</span> Dati sportivi da Supabase <span>·</span> ${E(state.base.seasons.find(s=>s.id===state.season)?.name||'')}</footer></div></div>${mobileNav()}<div id="modal-layer">${overlay()}</div><div id="toast" role="status" aria-live="polite"></div>`;
 if(state.page==='home'&&previousHomeScroll.length===2){
  document.querySelectorAll('.home-feature>.feature-primary,.home-feature>.home-side-stack').forEach((column,index)=>{column.scrollTop=previousHomeScroll[index]||0});
 }
 if(state.page==='competitions'&&!state.loading){const scroller=document.querySelector('[data-rounds-scroll]');const focus=scroller?.querySelector('[data-round-focus]');if(scroller&&focus){const next=scroller.querySelector('[data-round-next]');const bounds=scroller.getBoundingClientRect();const first=focus.getBoundingClientRect();const last=(next||focus).getBoundingClientRect();const top=first.top-bounds.top+scroller.scrollTop;const visibleHeight=last.bottom-first.top+12;scroller.style.height=Math.ceil(visibleHeight)+'px';scroller.scrollTop=Math.max(0,top);}}
 if(state.page==='admin'&&!state.loading)sizeClubEditor();
 if(state.page==='match'&&!state.loading){paintMatchHeaderCompact();requestAnimationFrame(()=>requestAnimationFrame(centerVotePickers))}
 if(state.page==='home'&&!state.loading){void hydrateHomeRatings();void hydrateHomeTeamRatings();}if(state.page==='match'&&!state.loading){void hydrateMatchTeamRating();void hydrateMatchPrediction();}
 manageCarousel();manageLivePolling();if(hasSession())syncNotificationBell(staffContext());maybeRequirePasswordChange(state.identity);if(state.page==='stats'&&!state.loading)fillAnalytics();if(state.page==='player'&&!state.loading&&state.player)hydratePlayerTrend(state.season,state.player);if(state.page==='competitions'&&!state.loading)updateProjection(currentComp(),fixtures(),state.data?.standings||[],state.base?.clubHistory||[],(row)=>{const match=(state.data?.standings||[]).find(x=>('team:'+x.team_id===row.club_id&&x.team_id)||('opponent:'+x.opponent_id===row.club_id&&x.opponent_id));return match?club(row.team,'tiny',{team_id:match.team_id,opponent_id:match.opponent_id}):''});paintLineupPitch();paintCallups();if(state.page==='match'&&!state.loading)startStaffClock(isStaff(staffContext())?staffContext():null);
}
function centerVotePickers(){
 document.querySelectorAll('[data-vote-picker]').forEach(picker=>{
  const target=picker.querySelector('.vote-picker-option.active')||picker.querySelector('[data-vote-focus="true"]');
  if(!target)return;
  const pickerRect=picker.getBoundingClientRect(),targetRect=target.getBoundingClientRect();
  const left=picker.scrollLeft+(targetRect.left-pickerRect.left)-(picker.clientWidth-targetRect.width)/2;
  picker.scrollLeft=Math.max(0,left);
 });
}
function toast(message){const el=$('#toast');if(!el)return;el.textContent=message;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),3500)}
function navigate(page){
 if(page==='admin'&&!isStaff(staffContext()))page='home';
 state.page=page;state.overlay=null;state.slide=0;if(page==='calendar')state.comp=null;
 history.replaceState(null,'',page==='match'&&state.match?matchRoute(state.match):'#'+page);
 render();window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
}
function changeSlide(nextIndex){const a=carouselFixtures();if(!a.length)return;state.slide=(nextIndex+a.length)%a.length;const slot=document.querySelector('[data-home-hero]');if(state.page==='home'&&slot){slot.innerHTML=hero();paintTeamWeightedRatings();return}render()}
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
 const loadId=++state.loadId;state.season=id;state.comp=null;state.match=null;state.player=null;state.slide=0;predictionEventCache=null;state.loading=true;render();
 try{const data=await loadSeason(id,isStaff(staffContext()),state.identity?.role?.role==='admin');if(loadId!==state.loadId)return;state.data=data;state.loading=false;sessionStorage.setItem('tm_next_season',id);render()}
 catch(e){state.loading=false;render();toast('Dati non disponibili: '+e.message)}
}
async function openMatch(id){
 if(!fixtures().some(x=>x.id===id))return;
 state.match=id;state.matchTab='overview';state.scoreEditing=false;state.timelineEditor=null;state.matchData=null;state.fixtureEvents=[];navigate('match');
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
async function hydrateMatchPrediction(){
 const target=document.querySelector('[data-prematch-prediction]');
 if(!target||predictionBusy||!state.data||!state.match)return;
 const f=fixtures().find(x=>x.id===state.match),comp=competition(f?.competition_id);
 if(!f||!comp||!['scheduled','postponed'].includes(String(f.status||'')))return;
 const chosen=state.season,matches=(state.data.matches||[]).filter(m=>!m.is_test);
 let events=[];
 try{
  if(predictionEventCache?.season===chosen)events=predictionEventCache.events;
  else{
   const ids=matches.map(m=>m.id).filter(Boolean);
   predictionBusy=true;
   const fixtureIds=realFixtures().filter(x=>x.status==='finished').map(x=>x.id).filter(Boolean);
   const queries=[];
   if(ids.length)queries.push(get('app_match_events','select=id,match_id,fixture_id,event_type,minute,stoppage_minute,team_side,player_id,secondary_player_id,validation_status,payload,created_at&match_id=in.('+
    ids.map(encodeURIComponent).join(',')+')&limit=2000').catch(()=>[]));
   if(fixtureIds.length)queries.push(get('app_match_events','select=id,match_id,fixture_id,event_type,minute,stoppage_minute,team_side,player_id,secondary_player_id,validation_status,payload,created_at&fixture_id=in.('+
    fixtureIds.map(encodeURIComponent).join(',')+')&limit=2000').catch(()=>[]));
   const batches=queries.length?await Promise.all(queries):[];
   const merged=new Map();for(const batch of batches)for(const event of batch)merged.set(event.id,event);
   events=[...merged.values()];
   if(chosen!==state.season)return;
   predictionEventCache={season:chosen,events};
  }
  const signature=predictionSignature({fixture:f,fixtures:realFixtures(),history:state.base?.clubHistory||[],venues:state.base?.venues||[],events});
  if(target.dataset.ready===signature)return;
  const result=predictMatch({
   fixture:f,competition:comp,fixtures:realFixtures(),history:state.base?.clubHistory||[],
   venues:state.base?.venues||[],matches,events,team:team(),competitions:state.data?.competitions||[]
  });
  const current=document.querySelector('[data-prematch-prediction="'+CSS.escape(f.id)+'"]');
  if(current){
   current.innerHTML='<div class="prematch-prediction-head"><div><span class="eyebrow">MODELLO PRE-PARTITA</span><h3>Pronostico statistico</h3></div><span class="prematch-model-badge">DATI · NON QUOTE</span></div>'+
    renderPreMatchPrediction(result,E);
   current.dataset.ready=signature;
  }
  const lineupTarget=document.querySelector('[data-prematch-lineup="'+CSS.escape(f.id)+'"]');
  if(lineupTarget){
   if(!isStaff(staffContext()))lineupTarget.innerHTML='<div class="prematch-lineup-empty">Formazione ipotetica disponibile allo staff.</div>';
   else{
    const operational=resolveMatch().operational;
    const kits=collectionForClub(team()||{});
    const preferred=f.home_team_id===team()?.id?'home':'away';
    const kit=kits[operational?.match_kit_key]||kits[preferred]||kits.home||Object.values(kits)[0]||{};
    const matchIds=matches.map(m=>m.id).filter(Boolean);
    const [freshStats,freshRatings]=await Promise.all([
     get('app_player_season_stats','select=season_id,player_id,first_name,last_name,position_group,appearances,starts,minutes,goals,assists,yellow_cards,red_cards,blue_cards,avg_rating&season_id=eq.'+encodeURIComponent(chosen)+'&limit=1000').catch(()=>[]),
     matchIds.length?get('app_match_ratings','select=match_id,player_id,rating,created_at&match_id=in.('+matchIds.map(encodeURIComponent).join(',')+')&limit=10000').catch(()=>[]):Promise.resolve([])
    ]);
    const lineupData={...state.data,
     playerStats:freshStats.length?freshStats:(state.data.playerStats||[]),
     seasonRatings:freshRatings.length?freshRatings:(state.data.seasonRatings||[])
    };
    const model=buildHypotheticalLineup({
     fixture:f,targetMatch:operational,data:lineupData,matchData:state.matchData,team:team(),competition:comp,
     competitions:state.data?.competitions||[],prediction:result,kit,events
    });
    lineupTarget.innerHTML=renderHypotheticalLineup(model,E);
   }
  }
 }catch(error){
  const current=document.querySelector('[data-prematch-prediction]');
  if(current)current.innerHTML='<div class="prematch-prediction-head"><div><span class="eyebrow">MODELLO PRE-PARTITA</span><h3>Pronostico statistico</h3></div></div><p class="empty">Pronostico non disponibile: '+E(error.message)+'</p>';
  const lineupTarget=document.querySelector('[data-prematch-lineup]');
  if(lineupTarget)lineupTarget.innerHTML='<div class="prematch-lineup-empty">Formazione ipotetica non disponibile.</div>';
 }finally{predictionBusy=false}
}
async function fillAnalytics(){
 const box=document.querySelector('[data-event-analysis]');if(!box||!state.data)return;
 if(verifiedEventCache?.season===state.season){
  const matches=(state.data.matches||[]).filter(m=>!m.is_test);
  box.innerHTML=renderEventAnalytics(realFixtures(),matches,verifiedEventCache.events.filter(e=>matches.some(m=>m.id===e.match_id)),team(),state.data.competitions||[],state.data.playerStats||[],state.base?.opponents||[]);return;
 }
 if(analyticsBusy)return;
 const chosen=state.season,matches=(state.data.matches||[]).filter(m=>!m.is_test),ids=matches.map(m=>m.id).filter(Boolean);
 if(!ids.length){verifiedEventCache={season:chosen,events:[]};box.innerHTML=renderEventAnalytics(realFixtures(),matches,[],team(),state.data.competitions||[],state.data.playerStats||[],state.base?.opponents||[]);return}
 analyticsBusy=true;
 try{
  const query='select=match_id,event_type,minute,stoppage_minute,team_side,player_id,secondary_player_id,validation_status,payload,created_at&match_id=in.('+
   ids.map(encodeURIComponent).join(',')+')&limit=1000';
  const events=await get('app_match_events',query);
  if(chosen!==state.season)return;
  verifiedEventCache={season:chosen,events};
  const current=document.querySelector('[data-event-analysis]');
  if(current)current.innerHTML=renderEventAnalytics(realFixtures(),matches,events,team(),state.data.competitions||[],state.data.playerStats||[],state.base?.opponents||[]);
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
 const kitChoice=e.target.closest('[data-match-kit-choice]');
 if(kitChoice){
  const m=resolveMatch().operational,available=collectionForClub(team()||{});
  const key=kitChoice.dataset.matchKitChoice;
  if(!isStaff(staffContext())||!m||!Object.hasOwn(available,key))return;
  for(const b of document.querySelectorAll('[data-match-kit-choice]'))b.disabled=true;
  try{await rpc('tm_app_match_details',{p_match_id:m.id,p_kit_key:key});m.match_kit_key=key;toast('Maglia partita salvata');render();}
  catch(err){toast('Maglia non salvata: '+err.message);for(const b of document.querySelectorAll('[data-match-kit-choice]'))b.disabled=false;}
  return;
 }
 const confirm=e.target.closest('[data-lineup-confirm]');
 if(confirm){
  const form=confirm.closest('form[data-staff-form="lineup"]');
  if(!form||form.dataset.lineupEnabled!=='true')return;
  confirm.disabled=true;
  try{
   clearTimeout(lineupTimer);
   if(lineupPendingSnapshot?.matchId===form.dataset.lineupMatch)await persistLineupSnapshot(lineupPendingSnapshot);
   const confirmed=await rpc('tm_app_confirm_lineup',{p_match_id:form.dataset.lineupMatch});
   const m=resolveMatch().operational;if(m){m.lineup_confirmed_at=confirmed; m.lineup_confirmed_by=state.identity.user;}
   lineupPendingSnapshot=null;
   toast('Formazione iniziale ufficialmente confermata');render();
  }catch(err){toast('Conferma non riuscita: '+err.message);confirm.disabled=false}
  return;
 }
 const timelineClose=e.target.closest('[data-timeline-close]');
 if(timelineClose){
  if(timelineClose.classList?.contains('timeline-editor-backdrop')&&e.target!==timelineClose)return;
  state.timelineEditor=null;render();return;
 }
 const timelineEvent=e.target.closest('[data-timeline-event]');
 if(timelineEvent&&state.identity?.role?.role==='admin'){
  state.timelineEditor={eventId:timelineEvent.dataset.timelineEvent};render();return;
 }
 const timelineAdd=e.target.closest('[data-timeline-add]');
 if(timelineAdd&&state.identity?.role?.role==='admin'){
  state.timelineEditor={eventId:null,minute:timelineAdd.dataset.minute||'',stoppage:timelineAdd.dataset.stoppage||0};render();return;
 }
 const timelineDelete=e.target.closest('[data-timeline-delete]');
 if(timelineDelete&&state.identity?.role?.role==='admin'){
  const {operational:m}=resolveMatch(),id=timelineDelete.dataset.timelineDelete;
  if(!window.confirm('Eliminare questo evento dalla partita?'))return;
  try{
   if(m)await rpc('tm_app_match_action',{p_match_id:m.id,p_action:'void_event',p_payload:{event_id:id}});
   else await adminWrite('app_match_events','PATCH',{validation_status:'rejected'},{id});
   state.timelineEditor=null;
   if(m)state.matchData=await loadMatchInfo(m.id);else state.fixtureEvents=await loadFixtureEvents(state.match);
   render();toast('Evento eliminato');
  }catch(error){toast('Eliminazione non riuscita: '+error.message)}
  return;
 }
 const eventReaction=e.target.closest('[data-event-reaction]');
 if(eventReaction){
  if(!['admin','player'].includes(state.identity?.role?.role)){toast('Solo giocatori e amministratori possono validare gli eventi');return}
  const reaction=Number(eventReaction.dataset.eventReaction),eventId=eventReaction.dataset.eventId;
  const m=resolveMatch().operational;if(!m||!eventId)return;
  let note=null,proposedChanges={};
  if(reaction===-1){
   const category=window.prompt('Cosa contesti? Scrivi: minuto, giocatore, tipo, squadra, non avvenuto oppure altro.','minuto');
   if(category===null)return;
   const normalizedCategory=category.trim().toLowerCase();
   const allowed=['minuto','giocatore','tipo','squadra','non avvenuto','altro'];
   if(!allowed.includes(normalizedCategory)){toast('Categoria contestazione non valida');return}
   note=window.prompt('Descrivi brevemente la correzione proposta.');
   if(note===null)return;
   note=note.trim();
   if(!note){toast('Indica cosa deve essere corretto');return}
   proposedChanges={category:normalizedCategory};
  }
  eventReaction.disabled=true;
  try{
   const result=await rpc('tm_app_react_event',{p_match_id:m.id,p_event_id:eventId,p_reaction:reaction,p_note:note,p_proposed_changes:proposedChanges});
   await refreshLive();
   toast(result?.status==='official'?'Evento confermato':result?.status==='disputed'?'Errore segnalato · evento da rivedere':'Conferma registrata · revisione gestione necessaria');
  }catch(err){eventReaction.disabled=false;toast('Validazione non riuscita: '+err.message)}
  return;
 }
 const votePick=e.target.closest('[data-vote-pick]');
 if(votePick){
  e.preventDefault();
  if(!hasSession()){state.overlay='login';render();return}
  const m=resolveMatch().operational;if(!m)return;
  const value=Number(votePick.dataset.voteValue);
  votePick.disabled=true;
  try{
   await saveVote(m.id,votePick.dataset.votePlayer,value);
   state.matchData=await loadMatchInfo(m.id);
   render();toast('Valutazione '+String(value).replace('.',',')+' salvata');
  }catch(error){votePick.disabled=false;toast('Voto non salvato: '+(error.message||error))}
  return;
 }
 const voteClear=e.target.closest('[data-vote-clear]');
 if(voteClear){
  e.preventDefault();
  if(!hasSession())return;
  const m=resolveMatch().operational;if(!m)return;
  voteClear.disabled=true;
  try{
   await saveVote(m.id,voteClear.dataset.votePlayer,'');
   state.matchData=await loadMatchInfo(m.id);
   render();toast('Voto impostato su SV');
  }catch(error){voteClear.disabled=false;toast('SV non salvato: '+(error.message||error))}
  return;
 }
 const tournamentScoreTarget=e.target.closest('[data-tournament-score]');
 if(tournamentScoreTarget){
  e.preventDefault();e.stopPropagation();
  await enterTournamentFinalScore(tournamentScoreTarget.dataset.tournamentScore);
  return;
 }
 const staffTarget=e.target.closest('[data-staff-action],[data-staff-area],[data-staff-match-tab]');
 if(staffTarget&&await staffClick(e,staffTarget,staffContext()))return;
 const x=e.target.closest('button,[data-dismiss]');if(!x)return;
 if(x.dataset.calendarNew!==undefined){
  if(state.identity?.role?.role==='admin'){state.overlay='new-test-match';render();}
  return;
 }
 if(x.dataset.dismiss!==undefined&&e.target===x){state.overlay=null;render();return}
 if(x.dataset.rosterNew!==undefined){if(isStaff(staffContext())){openNewPlayer();navigate('admin')}return}
 if(x.dataset.rosterSort){const k=x.dataset.rosterSort;state.rosterDesc=state.rosterSort===k?!state.rosterDesc:['shirt','age','appearances','goals','avg_rating'].includes(k);state.rosterSort=k;render();return}
 if(x.dataset.page){navigate(x.dataset.page);return}
 if(x.dataset.scoreEdit!==undefined){
  if(state.identity?.role?.role!=='admin')return;
  if(!state.scoreEditing){state.scoreEditing=true;state.timelineEditor=null;render()}
  else{
   const f=resolveMatch().fixture;
   state.timelineEditor=null;
   if(f&&!involvesTeam(f,team()))await saveExtraScore();
   else{state.scoreEditing=false;render()}
  }
  return;
 }
 if(x.dataset.scoreCancel!==undefined){state.scoreEditing=false;render();return}
 if(x.dataset.extraRemove){if(state.identity?.role?.role==='admin'){try{await adminWrite('app_match_events','PATCH',{validation_status:'rejected'},{id:x.dataset.extraRemove});state.fixtureEvents=await loadFixtureEvents(state.match);render();toast('Evento escluso')}catch(error){toast(error.message)}}return}
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
document.addEventListener('change',async e=>{
 if(e.target.matches('[data-match-kit]')){
  const m=resolveMatch().operational;if(!m)return;
  try{await rpc('tm_app_match_details',{p_match_id:m.id,p_kit_key:e.target.value||null});m.match_kit_key=e.target.value;toast('Divisa salvata')}
  catch(err){toast('Divisa non salvata: '+err.message)}
  return;
 }
 if(e.target.matches('[data-unused-player]')){
  const m=resolveMatch().operational;if(!m)return;
  try{await rpc('tm_app_match_details',{p_match_id:m.id,p_reason_player:e.target.dataset.unusedPlayer,p_reason:e.target.value||null});
   const pl=state.matchData?.players?.find(p=>p.player_id===e.target.dataset.unusedPlayer);if(pl)pl.unused_sub_reason=e.target.value||null;
   toast('Motivo salvato')}
  catch(err){toast('Motivo non salvato: '+err.message)}
  return;
 }
 if(e.target.matches('[data-extra-field]')){
  const key=e.target.dataset.extraField;let value=e.target.value;
  if(key==='kickoff_at'){const d=new Date(value);if(!Number.isFinite(d.getTime())){toast('Data non valida');return}value=d.toISOString()}
  if(['kickoff_at','venue_name','venue_address'].includes(key))await saveExtraDetail(key,value||null);
 }
 if(e.target.matches('[data-extra-status]'))await saveExtraDetail('status',e.target.value);
});
document.addEventListener('change',e=>{
 if(staffLogoEvent(e))return;
 if(e.target.matches('[data-staff-select]')){staffSelect(e.target,staffContext());return}
 if(e.target.matches('[data-season]'))switchSeason(e.target.value);
 if(e.target.matches('[data-mine]')){state.mineOnly=e.target.checked;render()}
 if(e.target.matches('[data-comp-select]')){state.comp=e.target.value||null;render()}
});
document.addEventListener('pointerdown',e=>{
 const submit=e.target.closest?.('form[data-staff-form="event"] [type="submit"]');
 const form=submit?.closest?.('form[data-staff-form="event"]');
 const captured=form?.querySelector?.('input[name="captured_at"]');
 if(captured&&!captured.value)captured.value=new Date().toISOString();
},{capture:true,passive:true});
document.addEventListener('paste',e=>{staffLogoEvent(e)});
for(const type of ['pointerdown','pointermove','pointerup','pointercancel','dragstart','dragover','drop']){
 document.addEventListener(type,e=>{staffLogoEvent(e)});
}
document.addEventListener('input',e=>{
 if(staffLogoEvent(e))return;
 if(e.target.id==='player-search'){
  state.q=e.target.value;const query=normalized(state.q);let visible=0;
  document.querySelectorAll('[data-search-name]').forEach(el=>{const show=el.dataset.searchName.includes(query);el.hidden=!show;if(show)visible++});
  const missing=$('#roster-empty');if(missing)missing.hidden=visible>0;
 }
});
async function enterTournamentFinalScore(fixtureId){
 if(state.identity?.role?.role!=='admin')return;
 const f=fixtures().find(x=>String(x.id)===String(fixtureId));if(!f)return;
 const raw=window.prompt('Risultato finale · '+f.home_team+' — '+f.away_team+'\nInserisci nel formato 2-1','0-0');
 if(raw===null)return;
 const match=String(raw).trim().match(/^(\d{1,2})\s*[-–:]\s*(\d{1,2})$/);
 if(!match){toast('Formato non valido. Usa ad esempio 2-1');return}
 const home=Number(match[1]),away=Number(match[2]);
 if(home>99||away>99){toast('Punteggio non valido');return}
 try{
  await adminWrite('app_competition_fixtures','PATCH',{home_score:home,away_score:away,status:'finished'},{id:f.id});
  f.home_score=home;f.away_score=away;f.status='finished';
  const operational=(state.data?.matches||[]).find(m=>m.fixture_id===f.id);
  if(operational){
   try{
    await adminWrite('app_matches','PATCH',{home_score:home,away_score:away,status:'finished'},{id:operational.id});
    Object.assign(operational,{home_score:home,away_score:away,status:'finished'});
   }catch(error){console.warn('Tabellino operativo non allineato al risultato torneo:',error.message)}
  }
  render();toast('Risultato finale salvato');
 }catch(error){toast('Risultato non salvato: '+error.message)}
}
async function saveExtraScore(){
 const f=resolveMatch().fixture;if(!f||state.identity?.role?.role!=='admin')return;
 const goals=(state.fixtureEvents||[]).filter(x=>x.validation_status!=='rejected'&&['goal','penalty_goal','penalty_scored','own_goal'].includes(x.event_type)).reduce((a,x)=>{const side=x.event_type==='own_goal'?(x.side==='home'?'away':'home'):x.side;if(side==='home')a.home++;if(side==='away')a.away++;return a},{home:0,away:0});
 try{await adminWrite('app_competition_fixtures','PATCH',{home_score:goals.home,away_score:goals.away},{id:f.id});f.home_score=goals.home;f.away_score=goals.away;state.scoreEditing=false;render();toast('Risultato aggiornato dai gol registrati')}
 catch(error){toast('Salvataggio risultato non riuscito: '+error.message)}
}
async function saveExtraDetail(field,value){
 const f=resolveMatch().fixture;if(!f||state.identity?.role?.role!=='admin')return;
 try{await adminWrite('app_competition_fixtures','PATCH',{[field]:value},{id:f.id});f[field]=value;render();toast('Dettaglio aggiornato')}catch(error){toast('Modifica non salvata: '+error.message)}
}
function mergeMatchPlayerState(rows){
 if(!state.matchData)state.matchData={players:[]};
 if(!Array.isArray(state.matchData.players))state.matchData.players=[];
 const byId=new Map(state.matchData.players.map(p=>[p.player_id,p]));
 for(const row of rows){
  const current=byId.get(row.player_id);
  const next={...(current||{}),...row,started:row.selection_status==='starter'};
  if(row.selection_status!=='absent'){next.unavailability_reason=null;next.unavailability_note=null}
  if(current)Object.assign(current,next);
  else{state.matchData.players.push(next);byId.set(row.player_id,next)}
 }
}
async function reloadMatchDataIfCurrent(matchId){
 const current=resolveMatch().operational;
 if(!current||current.id!==matchId)return;
 try{state.matchData=await loadMatchInfo(matchId);render()}catch(error){toast('Ricaricamento tabellino non riuscito: '+error.message)}
}
let lineupTimer=null,lineupPendingSnapshot=null;
document.addEventListener('tm-lineup-change',e=>{
 const form=e.detail.form;
 if(!form?.isConnected||form.dataset.lineupEnabled!=='true')return;
 const matchId=form.dataset.lineupMatch;
 const rows=[...form.querySelectorAll('[data-lineup-player]')].map(el=>{
  const value=n=>el.querySelector('[name="'+n+'"]')?.value||'';
  const rawStatus=value('status');
  const selection_status=rawStatus==='starter'?'starter':'bench';
  return {player_id:el.dataset.lineupPlayer,selection_status,
   shirt_number:value('shirt')?Number(value('shirt')):null,
   tactical_slot:selection_status==='starter'?(Number(value('slot'))||null):null,
   is_captain:form.querySelector('[name=captain]:checked')?.value===el.dataset.lineupPlayer&&selection_status==='starter',
   unavailability_reason:null,unavailability_note:null};
 });
 const snapshot={matchId,formation:form.elements.formation?.value||'4-4-2',rows};
 lineupPendingSnapshot=snapshot;
 // Keep tab switches consistent while the debounced write is still pending.
 mergeMatchPlayerState(rows);
 const localMatch=state.data?.matches?.find(x=>x.id===matchId);if(localMatch)localMatch.formation=snapshot.formation;
 const label=form.querySelector('[data-lineup-save-status]');
 if(label)label.textContent='Modifiche da salvare…';
 clearTimeout(lineupTimer);
 lineupTimer=setTimeout(()=>{
  if(label?.isConnected)label.textContent='Salvataggio…';
  void persistLineupSnapshot(snapshot,error=>{
   if(error){
    if(label?.isConnected)label.textContent='Errore: '+error.message;
    if(lineupPendingSnapshot===snapshot)void reloadMatchDataIfCurrent(matchId);
   }else if(label?.isConnected)label.textContent='Salvato';
  }).catch(()=>{});
 },350);
});
document.addEventListener('tm-callup-change',e=>{
 const detail=e.detail;
 const getRow=()=>[...document.querySelectorAll('[data-callup-player]')].find(x=>x.dataset.callupPlayer===detail.playerId);
 const row=getRow();
 if(row){row.dataset.saving='true';row.dataset.saveError='false';row.querySelectorAll('[data-callup-reason]').forEach(button=>button.disabled=true)}
 // Optimistic match state: Formazione must immediately see the same availability as Convocazioni.
 mergeMatchPlayerState([{player_id:detail.playerId,selection_status:detail.status,
  unavailability_reason:detail.status==='absent'?detail.reason:null,
  unavailability_note:null,tactical_slot:null,is_captain:false}]);
 void persistCallupChange(detail,error=>{
  const current=getRow();
  if(current){
   current.dataset.saving='false';current.dataset.saveError=String(Boolean(error));
   current.querySelectorAll('[data-callup-reason]').forEach(button=>button.disabled=current.dataset.locked==='true');
   if(error){
    current.querySelector('[name=selection]').value=current.dataset.persistedStatus;
    current.querySelector('[name=reason]').value=current.dataset.persistedReason;
    paintCallups();
   }else{
    current.dataset.persistedStatus=detail.status;
    current.dataset.persistedReason=detail.status==='absent'?detail.reason:'';
   }
  }
  if(error)void reloadMatchDataIfCurrent(detail.matchId);
  toast(error?'Convocazione NON salvata: '+error.message:'Convocazione salvata');
 }).catch(()=>{});
});
document.addEventListener('submit',async e=>{
 if(e.target.matches('[data-timeline-event-form]')){
  e.preventDefault();
  if(state.identity?.role?.role!=='admin')return;
  const form=e.target,fd=new FormData(form),{fixture:f,operational:m}=resolveMatch();
  if(!f)return;
  const eventId=form.dataset.eventId||null;
  const minuteRaw=String(fd.get('minute')??'').trim(),stoppageRaw=String(fd.get('stoppage_minute')??'').trim();
  const minute=minuteRaw===''?null:Number(minuteRaw),stoppage=stoppageRaw===''?0:Number(stoppageRaw);
  const type=String(fd.get('event_type')||'goal'),teamSide=String(fd.get('team_side')||(m?'team':'home'));
  if(minute!==null&&(!Number.isInteger(minute)||minute<0||minute>300)){toast('Minuto non valido');return}
  if(!Number.isInteger(stoppage)||stoppage<0||stoppage>30){toast('Recupero non valido');return}
  try{
   if(m){
    const period=String(fd.get('period')||'first_half');
    const periodLen=Number(matchRules(m,competition(f.competition_id))?.minutes_per_period||40);
    const eventMinute=type==='substitution'&&period==='halftime'?periodLen:minute;
    const eventStoppage=type==='substitution'&&period==='halftime'?0:stoppage;
    const periodNo=period==='second_half'?2:period==='extra'?3:1;
    if(eventId){
     const ev=state.matchData?.events?.find(x=>String(x.id)===String(eventId));if(!ev)throw Error('Evento non trovato');
     const counted=Boolean(ev.payload?.counted_in_score);
     if(counted&&(type!==ev.event_type||teamSide!==ev.team_side))throw Error('Per un gol già conteggiato puoi modificare minuto/giocatore, non tipo o squadra');
     const payload={...(ev.payload||{}),period,period_no:periodNo,notes:String(fd.get('notes')||'')};
     await adminWrite('app_match_events','PATCH',{
      event_type:type,team_side:teamSide,player_id:teamSide==='team'?(fd.get('player_id')||null):null,
      secondary_player_id:teamSide==='team'?(fd.get('secondary_player_id')||null):null,
      minute:eventMinute,stoppage_minute:eventStoppage,payload
     },{id:eventId});
    }else{
     if(m.status==='live'){
      await rpc('tm_app_submit_live_event',{p_match_id:m.id,p_event:{event_type:type,team_side:teamSide,player_id:fd.get('player_id')||null,secondary_player_id:fd.get('secondary_player_id')||null,minute:eventMinute,stoppage_minute:eventStoppage,notes:String(fd.get('notes')||''),count_score:true,captured_at:new Date().toISOString(),minute_mode:'manual',minute_origin:'manual',request_key:crypto.randomUUID(),payload:{period,period_no:periodNo}}});
     }else{
      await adminWrite('app_match_events','POST',{match_id:m.id,fixture_id:f.id,event_type:type,team_side:teamSide,player_id:teamSide==='team'?(fd.get('player_id')||null):null,secondary_player_id:teamSide==='team'?(fd.get('secondary_player_id')||null):null,minute:eventMinute,stoppage_minute:eventStoppage,payload:{period,period_no:periodNo,notes:String(fd.get('notes')||''),entered_from:'timeline_admin',count_score:false},proposed_by:state.identity.user,validation_status:'official',source:'manual'});
     }
    }
    state.matchData=await loadMatchInfo(m.id);
   }else{
    const payload={event_type:type,team_side:teamSide,minute,stoppage_minute:stoppage,source:'manual',source_raw:{},payload:{origin:'timeline_admin'},proposed_by:state.identity.user};
    if(eventId)await adminWrite('app_match_events','PATCH',payload,{id:eventId});
    else await adminWrite('app_match_events','POST',{...payload,fixture_id:f.id,match_id:null});
    state.fixtureEvents=await loadFixtureEvents(f.id);
   }
   state.timelineEditor=null;render();toast(eventId?'Evento aggiornato':'Evento aggiunto');
  }catch(error){toast('Evento non salvato: '+error.message)}
  return;
 }
 if(e.target.matches('form[data-staff-form="event"]')){
  const captured=e.target.querySelector('input[name="captured_at"]');
  if(captured&&!captured.value)captured.value=new Date().toISOString();
 }
 if(e.target.matches('[data-extra-event-form]')){
  e.preventDefault();if(state.identity?.role?.role!=='admin'||!state.scoreEditing)return;
  const f=resolveMatch().fixture;if(!f||involvesTeam(f,team()))return;
  const fd=new FormData(e.target),kind=String(fd.get('event_type')),side=String(fd.get('team_side')),raw=String(fd.get('minute')||'').trim();
  const minute=raw===''?null:Number(raw);
  if(!['goal','own_goal','yellow_card','blue_card','red_card'].includes(kind)||!['home','away'].includes(side)||minute!==null&&(!Number.isInteger(minute)||minute<0||minute>300)){toast('Evento non valido');return}
  const existing=state.fixtureEvents.find(x=>x.id===e.target.dataset.eventId);
  const payload={event_type:kind,team_side:side,minute,source_raw:{period:'first_half'},payload:{origin:'extra_manual'},source:'manual'};
  try{
   await adminWrite('app_match_events',existing?'PATCH':'POST',existing?{event_type:kind,team_side:side,minute,source_raw:payload.source_raw,payload:payload.payload}:{...payload,fixture_id:f.id,match_id:null,proposed_by:state.identity.user},existing?{id:existing.id}:{});
   state.fixtureEvents=await loadFixtureEvents(f.id);render();toast('Evento salvato');
  }catch(error){toast('Evento non salvato: '+error.message)}return;
 }
 if(e.target.id==='private-match-form'){
  e.preventDefault();
  if(state.identity?.role?.role!=='admin')return;
  const fd=new FormData(e.target),error=e.target.querySelector('#private-match-error'),button=e.target.querySelector('[type="submit"]');
  const periods=Number(fd.get('periods')),minutes=Number(fd.get('minutes_per_period'));
  const kickoff=new Date(String(fd.get('kickoff_at')||''));
  if(!fd.get('opponent_id')){error.textContent='Seleziona un’avversaria.';return}
  if(!Number.isFinite(kickoff.getTime())){error.textContent='Data e ora non valide.';return}
  if(!Number.isInteger(periods)||periods<1||periods>6||!Number.isInteger(minutes)||minutes<1||minutes>120){error.textContent='Numero o durata dei tempi non validi.';return}
  button.disabled=true;button.textContent='Creazione…';error.textContent='';
  try{
   const result=await rpc('tm_app_create_private_match',{
    p_season_id:state.season,p_opponent_id:String(fd.get('opponent_id')),p_home_away:String(fd.get('home_away')||'home'),
    p_kickoff_at:kickoff.toISOString(),p_venue_name:String(fd.get('venue_name')||'').trim()||null,p_venue_address:null,
    p_periods:periods,p_minutes_per_period:minutes,p_rolling_substitutions:fd.get('rolling_substitutions')==='on'
   });
   state.overlay=null;
   await switchSeason(state.season);
   toast('Partita di test creata');
   if(result?.fixture_id)await openMatch(result.fixture_id);
  }catch(err){error.textContent=err.message||String(err);button.disabled=false;button.textContent='Crea partita'}
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


