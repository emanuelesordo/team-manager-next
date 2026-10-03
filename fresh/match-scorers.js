import {cumulativeEventMinute,displayEventMinute} from './match-minutes.js';


const goalTypes=new Set(['goal','own_goal','penalty_scored','penalty_goal']);
/** Return actual scorers as recorded; do not infer any missing scorer from the final score. */
export function matchScorerRows(events=[],fixture={},team={},playerName=()=>null,competition=null){
 const ownHome=Boolean(team?.id&&fixture.home_team_id===team.id);
 const rows={home:[],away:[]};
 for(const event of events){
  if(!goalTypes.has(String(event.event_type||'').toLowerCase())||event.validation_status==='rejected')continue;
  const teamSide=String(event.team_side||'').toLowerCase();
  let side=teamSide==='home'?'home':teamSide==='away'?'away':
   teamSide==='team'?(ownHome?'home':'away'):
   teamSide==='opponent'?(ownHome?'away':'home'):null;
  if(!side)continue;
  const named=event.player_id?playerName(event.player_id):null;
  const shirt=event.payload?.opponent_shirt_number||event.payload?.shirt_number;
  const name=named&&named!=='Giocatore non censito'?named:shirt?'#'+shirt:'Marcatore non indicato';
  rows[side].push({
   id:event.id||null,minute:cumulativeEventMinute(event,competition),
   minuteText:displayEventMinute(event,competition,'—'),
   name
  });
 }
 for(const side of ['home','away'])rows[side].sort((a,b)=>(a.minute??999)-(b.minute??999));
 return rows;
}
export function renderMatchScorers(rows,side,escapeHtml=x=>String(x??'')){
 return '<div class="match-header-scorers match-header-scorers-'+side+'" aria-label="Marcatori '+(side==='home'?'casa':'ospiti')+'">'+
  (rows?.[side]||[]).map(item=>'<div class="match-header-scorer"><b class="match-scorer-minute">'+escapeHtml(item.minuteText)+'</b><span class="match-scorer-name">'+escapeHtml(item.name)+'</span></div>').join('')+
  '</div>';
}
