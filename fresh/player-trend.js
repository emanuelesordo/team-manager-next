import {get} from './api.js';
import {ratingTimeline} from './rating-timeline.js';
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cache=new Map();
let pending=null;
export function playerTrendPanel(player){
 const id=player?.id;
 return '<section class="glass panel player-trend-panel"><div class="panel-heading"><h2>Ultime valutazioni</h2></div>'+
  '<div data-player-trend="'+E(id)+'" aria-live="polite"><p class="muted small">Caricamento valutazioni…</p></div></section>';
}
export function renderPlayerTrend(rows,resolve=()=>({})){
 return ratingTimeline((rows||[]).map(r=>({...r,rating:r.avg_rating,...resolve(r)})),{title:'Rating del giocatore'});
}
export function hydratePlayerTrend(season,playerId,resolve=()=>({})){
 const el=document.querySelector('[data-player-trend="'+String(playerId).replace(/[^0-9a-f-]/gi,'')+'"]');
 if(!el)return;
 const key=season+'|'+playerId;
 if(cache.has(key)){el.innerHTML=renderPlayerTrend(cache.get(key),resolve);return}
 if(pending===key)return;
 pending=key;
 const q='select=season_id,match_id,kickoff_at,player_id,opponent,avg_rating,votes,sv&season_id=eq.'+
   encodeURIComponent(season)+'&player_id=eq.'+encodeURIComponent(playerId)+'&order=kickoff_at.desc&limit=5';
 get('tm_player_recent_votes',q).then(rows=>{
  cache.set(key,rows);if(cache.size>200)cache.delete(cache.keys().next().value);
  const target=document.querySelector('[data-player-trend="'+String(playerId).replace(/[^0-9a-f-]/gi,'')+'"]');
  if(target)target.innerHTML=renderPlayerTrend(rows,resolve);
 }).catch(error=>{
  const target=document.querySelector('[data-player-trend="'+String(playerId).replace(/[^0-9a-f-]/gi,'')+'"]');
  if(target)target.textContent='Valutazioni non disponibili: '+error.message;
 }).finally(()=>{pending=null});
}
