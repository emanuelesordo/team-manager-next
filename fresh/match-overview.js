import {matchPlayerLabel} from './match-player-label.js';
import {pitchPositions} from './lineup-pitch.js';
import {shirtSvg} from './kit-editor.js';
import {displayEventMinute,cumulativeEventMinute} from './match-minutes.js';

const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const relevantTypes=new Set(['goal','penalty_scored','own_goal','assist','yellow_card','red_card','blue_card','blue_return','substitution','second_yellow']);
const iconTypes={
 goal:['⚽','Gol'],penalty_scored:['⚽','Rigore segnato'],own_goal:['AG','Autogol'],
 assist:['A','Assist'],yellow_card:['','Ammonizione'],red_card:['','Espulsione'],
 blue_card:['','Cartellino blu'],second_yellow:['','Doppio cartellino'],blue_return:['↩','Rientro'],sub_in:['↗','Entrata'],sub_out:['↙','Uscita']
};
export function playerMatchEvents(playerId,events=[],competition=null){
 const result=[];
 for(const e of events){
  if(e.validation_status==='rejected'||!relevantTypes.has(e.event_type))continue;
  const t=e.event_type;
  // A dedicated assist row can mirror the assist already linked to a goal.
  if(t==='assist'&&e.player_id===playerId&&events.some(g=>
   ['goal','penalty_scored'].includes(g.event_type)&&g.validation_status!=='rejected'&&
   g.secondary_player_id===playerId&&g.minute===e.minute&&
   (g.payload?.period||'')===(e.payload?.period||'')))continue;
  let role=null;
  if(t==='substitution'){
   if(e.player_id===playerId)role='sub_out';
   if(e.secondary_player_id===playerId)role='sub_in';
  }else if(e.player_id===playerId)role=t;
  else if(e.secondary_player_id===playerId&&['goal','penalty_scored'].includes(t))role='assist';
  if(!role)continue;
  const [label,name]=iconTypes[role];
  result.push({kind:role,label,name,cardType:e.payload?.card_type||'',minute:cumulativeEventMinute(e,competition),
   time:displayEventMinute(e,competition)});
 }
 return result.sort((a,b)=>(a.minute??999)-(b.minute??999));
}
export function relativeRating(playerId,matchData,seasonStats=[]){
 const mean=(matchData?.ratingMeans||[]).find(x=>x.player_id===playerId);
 let score=Number(mean?.avg_rating),votes=Number(mean?.votes||0);
 if(!Number.isFinite(score)||votes<=0){
  const ratings=(matchData?.ratings||[]).filter(x=>x.player_id===playerId&&Number.isFinite(Number(x.rating)));
  votes=ratings.length;score=votes?ratings.reduce((sum,x)=>sum+Number(x.rating),0)/votes:NaN;
 }
 if(!votes||!Number.isFinite(score))return null;
 const level=score>=9?'elite':score>=8?'high':score>=7?'above':score>=6?'even':score>=5?'below':'low';
 return {score,level,votes};
}
export function overviewLineup(match,matchData,people=[],seasonStats=[],competition=null,kit=null){
 const roster=(matchData?.players||[]).filter(x=>x.selection_status!=='absent');
 const starters=roster.filter(x=>x.started||x.selection_status==='starter')
  .sort((a,b)=>(a.tactical_slot??99)-(b.tactical_slot??99)||(a.shirt_number??999)-(b.shirt_number??999));
 const bench=roster.filter(x=>!x.started&&x.selection_status==='bench')
  .sort((a,b)=>(a.shirt_number??999)-(b.shirt_number??999));
 const byId=new Map((people||[]).map(p=>[p.id,p]));

 const eventBadges=(events,side)=>{
  const kinds=side==='left'?['sub_in','sub_out','yellow_card','blue_card','double_card','red_card','blue_return']:['goal','assist','own_goal'];
  const grouped=new Map();
  for(const e of events){
   // Some feeds provide a second-yellow entry plus its resulting red card.
   if(e.kind==='second_yellow'&&events.some(r=>r.kind==='red_card'&&
    ['second_yellow_blue','second_card','second_yellow'].includes(r.cardType)&&
    Math.abs((r.minute??-100)-(e.minute??100))<=1))continue;
   let kind=e.kind;
   if(['goal','penalty_scored'].includes(kind))kind='goal';
   if(kind==='second_yellow')kind='double_card';
   if(kind==='red_card'&&['second_yellow_blue','second_card','second_yellow'].includes(e.cardType))kind='double_card';
   if(!kinds.includes(kind))continue;
   const entry=grouped.get(kind)||{count:0,times:[],blue:false};
   entry.count++;
   entry.times.push(e.time);
   if(e.cardType==='second_yellow_blue')entry.blue=true;
   grouped.set(kind,entry);
  }
  return kinds.filter(kind=>grouped.has(kind)).map(kind=>{
   const {count,times,blue}=grouped.get(kind);
   const names={
    sub_in:'Sostituzione · ingresso',sub_out:'Sostituzione · uscita',
    yellow_card:'Cartellino giallo',blue_card:'Cartellino blu',
    double_card:'Doppia sanzione',red_card:'Cartellino rosso',blue_return:'Rientro',
    goal:'Gol',assist:'Assist',own_goal:'Autogol'
   };
   const ballSvg=(own=false)=>'<svg class="ov-event-svg ov-event-ball'+(own?' ov-event-own-goal':'')+'" viewBox="0 0 24 24" aria-hidden="true">'+
    '<circle cx="12" cy="12" r="10.5" fill="'+(own?'#f0443e':'#111315')+'"/>'+
    '<circle cx="12" cy="12" r="7.6" fill="#f7f7f7"/>'+
    '<path d="M12 7.1 15 9.2l-1.15 3.45h-3.7L9 9.2Zm-5.2 3.7 2.2-1.6 1.15 3.45-2.25 2.75-2.6-1.55Zm10.4 0 1.5 3.05-2.6 1.55-2.25-2.75L15 9.2Zm-9.3 4.6 2.25-2.75h3.7l2.25 2.75-1.85 2.65h-4.5Z" fill="'+(own?'#f0443e':'#111315')+'"/>'+
    '<path d="m6.2 7.4 2.8 1.8M17.8 7.4 15 9.2M7.9 15.4 6.7 18m8.4-2.6 1.2 2.6" stroke="'+(own?'#f0443e':'#111315')+'" stroke-width="1" stroke-linecap="round"/></svg>';
   const subSvg=(direction,color)=>'<svg class="ov-event-svg ov-event-sub" viewBox="0 0 24 24" aria-hidden="true">'+
    '<circle cx="12" cy="12" r="10.5" fill="'+color+'"/>'+
    '<path d="'+(direction==='up'?'M12 17.5V6.8M7.9 10.9 12 6.8l4.1 4.1':'M12 6.5v10.7m-4.1-4.1 4.1 4.1 4.1-4.1')+'" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
   const cardSvg=color=>'<svg class="ov-event-svg ov-event-card" viewBox="0 0 20 24" aria-hidden="true">'+
    '<rect x="5.1" y="2.1" width="10.2" height="18.7" rx="1.15" transform="rotate(10 10 12)" fill="'+color+'"/>'+
    '<path d="M6.5 4.2 14 5.6" stroke="#fff" stroke-opacity=".12" stroke-width=".8"/></svg>';
   const doubleCardSvg=(blue=false)=>'<svg class="ov-event-svg ov-event-double-card" viewBox="0 0 24 24" aria-hidden="true">'+
    '<rect x="3.5" y="5" width="9.4" height="16.5" rx="1.1" transform="rotate(-7 8 13)" fill="'+(blue?'#378be7':'#f4bf1b')+'"/>'+
    '<rect x="10" y="2.2" width="9.7" height="18" rx="1.1" transform="rotate(8 15 11)" fill="#ef3e42"/>'+
    '<path d="M11.5 4.2 18.2 5.2" stroke="#fff" stroke-opacity=".12" stroke-width=".8"/></svg>';
   const assistSvg='<svg class="ov-event-svg ov-event-assist" viewBox="0 0 28 24" aria-hidden="true">'+
    '<path d="M5.2 16.2c2.8-.45 4.55-1.55 5.7-3.45 1.05-1.75 1.25-4.1 1.35-6.2l3.4.55c.15 1.65.75 3.1 1.85 4.35 1.25 1.45 3.05 2.55 5.7 3.65l1.6 3.1c.35.75-.15 1.6-1 1.6H6.1c-1.15 0-1.65-1.45-.9-2.25Z" fill="#f4f4f5"/>'+
    '<path d="m12.2 9.1 3.1.65m-3.45 2.1 3.7.75M7.4 18.1h16.2" fill="none" stroke="#202326" stroke-width="1.15" stroke-linecap="round"/></svg>';
   const injurySvg='<svg class="ov-event-svg ov-event-injury" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="3" fill="none" stroke="#e89da6" stroke-width="1.8"/><path d="M10 7h4v3h3v4h-3v3h-4v-3H7v-4h3Z" fill="#e89da6"/></svg>';
   const suspensionSvg='<svg class="ov-event-svg ov-event-suspension" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.7" fill="none" stroke="#e89da6" stroke-width="2"/><path d="m6.2 17.8 11.6-11.6" stroke="#e89da6" stroke-width="2" stroke-linecap="round"/></svg>';
   const icon=kind==='goal'?ballSvg(false):
    kind==='own_goal'?ballSvg(true):
    kind==='assist'?assistSvg:
    kind==='sub_in'?subSvg('up','#17843d'):
    kind==='sub_out'?subSvg('down','#b82c2c'):
    kind==='yellow_card'?cardSvg('#f4bf1b'):
    kind==='blue_card'?cardSvg('#378be7'):
    kind==='red_card'?cardSvg('#ef3e42'):
    kind==='double_card'?doubleCardSvg(blue):
    kind==='blue_return'?'<svg class="ov-event-svg ov-event-return" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8h8a5 5 0 0 1 0 10h-4" fill="none" stroke="#4f9bff" stroke-width="2.2" stroke-linecap="round"/><path d="m8 5-4 3 4 3" fill="none" stroke="#4f9bff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>':'';
   const title=names[kind]+' ('+count+') · '+times.join(', ');
   return '<span class="ov-marker-icon ov-icon-'+kind+'" title="'+escapeHtml(title)+'" aria-label="'+escapeHtml(title)+'">'+icon+
    (count>1?'<small class="ov-marker-count">'+count+'</small>':'')+'</span>';
  }).join('');
 };
 const renderPlayer=(row,onPitch=false)=>{
  const p=byId.get(row.player_id);
  const name=matchPlayerLabel(p);
  const rating=relativeRating(row.player_id,matchData,seasonStats);
  const events=playerMatchEvents(row.player_id,matchData?.events||[],competition);
  const eventMarkup=events.map(x=>'<span class="ov-event ov-'+escapeHtml(x.kind)+'" title="'+escapeHtml(x.name+' · '+x.time)+'" aria-label="'+escapeHtml(x.name+' '+x.time)+'">'+
   (['yellow_card','blue_card','red_card'].includes(x.kind)?'<i></i>':escapeHtml(x.label))+'</span>').join('');
  const ratingMarkup=rating?'<span class="ov-rating ov-rating-'+rating.level+'" title="Voto medio partita: '+rating.score.toFixed(2)+' ('+rating.votes+' voti)">'+rating.score.toFixed(1).replace('.',',')+'</span>':
   '<span class="ov-rating ov-no-rating" title="Nessun voto registrato">—</span>';
  const caption='<span class="ov-player-name">'+escapeHtml(name)+(row.is_captain?' <small class="ov-captain">(C)</small>':'')+'</span>';
  if(onPitch){
   return '<div class="ov-player ov-player-pitch" data-player-id="'+escapeHtml(row.player_id)+'">'+
    '<div class="ov-marker-art"><span class="ov-field-shirt">'+shirtSvg(kit||{},'overview-'+row.player_id,false,row.shirt_number)+'</span>'+
    '<span class="ov-marker-side ov-marker-side-left">'+eventBadges(events,'left')+'</span>'+
    '<span class="ov-marker-side ov-marker-side-right">'+eventBadges(events,'right')+'</span>'+
    ratingMarkup+'</div>'+caption+'</div>';
  }
  return '<div class="ov-player" data-player-id="'+escapeHtml(row.player_id)+'"><span class="ov-shirt">'+escapeHtml(row.shirt_number??'·')+'</span>'+
   caption+'<span class="ov-personal-events">'+eventMarkup+'</span>'+ratingMarkup+'</div>';
 };
 const label=match?.formation||'4-4-2';
 const positions=pitchPositions(label);
 const occupied=new Map(starters.map(row=>[Number(row.tactical_slot),row]));
 const pitch='<div class="visual-lineup"><div class="visual-field ov-tactical-field ov-pitch" aria-label="Formazione iniziale">'+
  '<span class="field-circle"></span><span class="field-midline"></span>'+
  positions.map(pos=>{const row=occupied.get(pos.slot);if(!row)return '';
   const p=byId.get(row.player_id),name=matchPlayerLabel(p);
   return '<div class="field-slot occupied" style="left:'+pos.x+'%;top:'+pos.y+'%" title="'+escapeHtml(name)+'">'+
   renderPlayer(row,true)+'</div>';
  }).join('')+'</div></div>';
 return '<section class="ov-lineup lineup-minimal ov-shared-field"><div class="ov-section-heading"><h3>Formazione titolare</h3><small>'+escapeHtml(label)+' · '+starters.length+' titolari'+(match.lineup_confirmed_at?' · confermata':' · provvisoria')+'</small></div>'+
  (starters.length?pitch:'<div class="empty">Formazione iniziale non registrata.</div>')+
  '<div class="ov-section-heading ov-bench-heading"><h3>Panchina</h3><small>'+bench.length+' giocatori</small></div>'+
  (bench.length?'<div class="ov-bench">'+bench.map(row=>renderPlayer(row,false)).join('')+'</div>':'<div class="empty">Nessun giocatore in panchina registrato.</div>')+
  '<p class="subnote">Il rating mostra esclusivamente la media dei voti della partita. Le icone riportano gli eventi individuali registrati.</p></section>';
}
