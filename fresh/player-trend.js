import {get} from './api.js';
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cache=new Map();
let pending=null;
export function playerTrendPanel(player){
 const id=player?.id;
 return '<section class="glass panel player-trend-panel"><div class="panel-heading"><h2>Ultime valutazioni</h2></div>'+
  '<div data-player-trend="'+E(id)+'" aria-live="polite"><p class="muted small">Caricamento valutazioni…</p></div></section>';
}
export function renderPlayerTrend(rows){
 if(!rows?.length)return '<p class="empty">Nessuna valutazione registrata in questa stagione.</p>';
 const fmt=val=>Number(val).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2});
 return '<div class="recent-votes">'+rows.map(r=>{
  const average=r.avg_rating==null?'SV':fmt(r.avg_rating);
  const count=Number(r.votes||0);
  const date=r.kickoff_at?new Date(r.kickoff_at).toLocaleDateString('it-IT',{day:'2-digit',month:'short'}):'—';
  const pct=Number.isFinite(Number(r.avg_rating))&&r.avg_rating!==null?Math.max(0,Math.min(100,Number(r.avg_rating)*10)):0;
  return '<div class="recent-vote"><span class="vote-date">'+E(date)+'</span>'+
   '<div class="vote-opp"><b>'+E(r.opponent||'Avversaria non identificata')+'</b>'+
   '<div class="vote-meter"><i style="width:'+pct+'%"></i></div><small>'+count+' '+(count===1?'voto':'voti')+(r.sv?' · '+r.sv+' SV':'')+'</small></div>'+
   '<strong>'+E(average)+'</strong></div>';
 }).join('')+'</div><p class="subnote">Medie dei voti delle singole partite concluse. Gli SV sono esclusi dalla media; nessuna identità di votante è pubblicata.</p>';
}
export function hydratePlayerTrend(season,playerId){
 const el=document.querySelector('[data-player-trend="'+String(playerId).replace(/[^0-9a-f-]/gi,'')+'"]');
 if(!el)return;
 const key=season+'|'+playerId;
 if(cache.has(key)){el.innerHTML=renderPlayerTrend(cache.get(key));return}
 if(pending===key)return;
 pending=key;
 const q='select=season_id,match_id,kickoff_at,player_id,opponent,avg_rating,votes,sv&season_id=eq.'+
   encodeURIComponent(season)+'&player_id=eq.'+encodeURIComponent(playerId)+'&order=kickoff_at.desc&limit=5';
 get('tm_player_recent_votes',q).then(rows=>{
  cache.set(key,rows);if(cache.size>200)cache.delete(cache.keys().next().value);
  const target=document.querySelector('[data-player-trend="'+String(playerId).replace(/[^0-9a-f-]/gi,'')+'"]');
  if(target)target.innerHTML=renderPlayerTrend(rows);
 }).catch(error=>{
  const target=document.querySelector('[data-player-trend="'+String(playerId).replace(/[^0-9a-f-]/gi,'')+'"]');
  if(target)target.textContent='Valutazioni non disponibili: '+error.message;
 }).finally(()=>{pending=null});
}
