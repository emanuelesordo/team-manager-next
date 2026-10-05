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
   const ballSvg=color=>'<svg class="ov-event-svg ov-event-ball" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="'+color+'"/><path d="M12 5.2 15.4 7.7 14.1 11.7 9.9 11.7 8.6 7.7ZM5.2 9.1 8.6 7.7 9.9 11.7 7.3 15 4.2 13.1ZM18.8 9.1 15.4 7.7 14.1 11.7 16.7 15 19.8 13.1ZM7.3 15 9.9 11.7 14.1 11.7 16.7 15 14.5 18.7H9.5Z" fill="'+(color==='#f0443e'?'#fff':'#111')+'"/><path d="M4.2 13.1 5.8 17.4 9.5 18.7M19.8 13.1 18.2 17.4 14.5 18.7M8.6 7.7 7.2 4.8M15.4 7.7 16.8 4.8" fill="none" stroke="'+(color==='#f0443e'?'#fff':'#111')+'" stroke-width="1.2"/></svg>';
   const subSvg=(direction,color)=>'<svg class="ov-event-svg ov-event-sub" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="'+color+'"/><path d="'+(direction==='up'?'M12 17V7M8 11l4-4 4 4':'M12 7v10m-4-4 4 4 4-4')+'" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
   const cardSvg=color=>'<svg class="ov-event-svg ov-event-card" viewBox="0 0 18 24" aria-hidden="true"><rect x="4" y="2" width="10" height="19" rx="1.2" transform="rotate(10 9 12)" fill="'+color+'"/></svg>';
   const doubleCardSvg='<svg class="ov-event-svg ov-event-double-card" viewBox="0 0 22 24" aria-hidden="true"><rect x="3" y="4" width="9" height="17" rx="1" transform="rotate(-6 7 12)" fill="#f0c323"/><rect x="9" y="2" width="9" height="18" rx="1" transform="rotate(8 13 11)" fill="#ef3e42"/></svg>';
   const assistSvg='<svg class="ov-event-svg ov-event-assist" viewBox="0 0 28 24" aria-hidden="true"><path d="M4 15c4-1 6-4 7-9l4 1c0 4 2 7 7 9l2 4H5Z" fill="#f5f6f7"/><path d="M7 18h16M12 8l4 2m-5 2 4 2" fill="none" stroke="#202326" stroke-width="1.4" stroke-linecap="round"/></svg>';
   const icon=kind==='goal'?ballSvg('#f5f6f7'):
    kind==='own_goal'?ballSvg('#f0443e'):
    kind==='assist'?assistSvg:
    kind==='sub_in'?subSvg('up','#17843d'):
    kind==='sub_out'?subSvg('down','#b82c2c'):
    kind==='yellow_card'?cardSvg('#f4bf1b'):
    kind==='blue_card'?cardSvg('#378be7'):
    kind==='red_card'?cardSvg('#ef3e42'):
    kind==='double_card'?doubleCardSvg:
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
