import {matchPlayerLabel} from './match-player-label.js';
import {pitchPositions} from './lineup-pitch.js';
import {shirtSvg} from './kit-editor.js';
import {displayEventMinute,cumulativeEventMinute} from './match-minutes.js';

const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const relevantTypes=new Set(['goal','penalty_scored','own_goal','assist','yellow_card','red_card','blue_card','blue_return','substitution']);
const iconTypes={
 goal:['⚽','Gol'],penalty_scored:['⚽','Rigore segnato'],own_goal:['AG','Autogol'],
 assist:['A','Assist'],yellow_card:['','Ammonizione'],red_card:['','Espulsione'],
 blue_card:['','Cartellino blu'],blue_return:['↩','Rientro'],sub_in:['↗','Entrata'],sub_out:['↙','Uscita']
};
export function playerMatchEvents(playerId,events=[],competition=null){
 const result=[];
 for(const e of events){
  if(e.validation_status==='rejected'||!relevantTypes.has(e.event_type))continue;
  const t=e.event_type;
  let role=null;
  if(t==='substitution'){
   if(e.player_id===playerId)role='sub_out';
   if(e.secondary_player_id===playerId)role='sub_in';
  }else if(e.player_id===playerId)role=t;
  else if(e.secondary_player_id===playerId&&['goal','penalty_scored'].includes(t))role='assist';
  if(!role)continue;
  const [label,name]=iconTypes[role];
  result.push({kind:role,label,name,minute:cumulativeEventMinute(e,competition),
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
 const level=score>=8.5?'high':score>=7?'above':score>=6?'even':score>=5?'below':'low';
 return {score,level,votes};
}
export function overviewLineup(match,matchData,people=[],seasonStats=[],competition=null,kit=null){
 const roster=(matchData?.players||[]).filter(x=>x.selection_status!=='absent');
 const starters=roster.filter(x=>x.started||x.selection_status==='starter')
  .sort((a,b)=>(a.tactical_slot??99)-(b.tactical_slot??99)||(a.shirt_number??999)-(b.shirt_number??999));
 const bench=roster.filter(x=>!x.started&&x.selection_status==='bench')
  .sort((a,b)=>(a.shirt_number??999)-(b.shirt_number??999));
 const byId=new Map((people||[]).map(p=>[p.id,p]));
 const renderPlayer=(row,onPitch=false)=>{
  const p=byId.get(row.player_id);
  const name=matchPlayerLabel(p);
  const rating=relativeRating(row.player_id,matchData,seasonStats);
  const events=playerMatchEvents(row.player_id,matchData?.events||[],competition);
  const eventMarkup=events.map(x=>'<span class="ov-event ov-'+escapeHtml(x.kind)+'" title="'+escapeHtml(x.name+' · '+x.time)+'" aria-label="'+escapeHtml(x.name+' '+x.time)+'">'+
    (['yellow_card','blue_card','red_card'].includes(x.kind)?'<i></i>':escapeHtml(x.label))+'</span>').join('');
  let ratingMarkup='<span class="ov-rating ov-no-rating" title="Nessun voto registrato">—</span>';
  if(rating){
   const title='Voto medio partita: '+rating.score.toFixed(2)+' ('+rating.votes+' voti)';
   ratingMarkup='<span class="ov-rating ov-rating-'+rating.level+'" title="'+escapeHtml(title)+'">'+rating.score.toFixed(1).replace('.',',')+'</span>';
  }
  return '<div class="ov-player" data-player-id="'+escapeHtml(row.player_id)+'">'+(onPitch?'':'<span class="ov-shirt">'+escapeHtml(row.shirt_number??'·')+'</span>')+
   '<span class="ov-player-name">'+escapeHtml(name)+(row.is_captain?' <small class="ov-captain">C</small>':'')+'</span>'+
   '<span class="ov-personal-events">'+eventMarkup+'</span>'+ratingMarkup+'</div>';
 };
 const label=match?.formation||'4-4-2';
 const positions=pitchPositions(label);
 const occupied=new Map(starters.map(row=>[Number(row.tactical_slot),row]));
 const pitch='<div class="visual-lineup"><div class="visual-field ov-tactical-field ov-pitch" aria-label="Formazione iniziale">'+
  '<span class="field-circle"></span><span class="field-midline"></span>'+
  positions.map(pos=>{const row=occupied.get(pos.slot);if(!row)return '';
   const p=byId.get(row.player_id),name=matchPlayerLabel(p);
   return '<div class="field-slot occupied" style="left:'+pos.x+'%;top:'+pos.y+'%" title="'+escapeHtml(name)+'">'+
   '<span class="ov-field-shirt">'+shirtSvg(kit||{},'overview-'+pos.slot,false,row.shirt_number)+'</span>'+renderPlayer(row,true)+'</div>';
  }).join('')+'</div></div>';
 return '<section class="ov-lineup lineup-minimal ov-shared-field"><div class="ov-section-heading"><h3>Formazione titolare</h3><small>'+escapeHtml(label)+' · '+starters.length+' titolari'+(match.lineup_confirmed_at?' · confermata':' · provvisoria')+'</small></div>'+
  (starters.length?pitch:'<div class="empty">Formazione iniziale non registrata.</div>')+
  '<div class="ov-section-heading ov-bench-heading"><h3>Panchina</h3><small>'+bench.length+' giocatori</small></div>'+
  (bench.length?'<div class="ov-bench">'+bench.map(row=>renderPlayer(row,false)).join('')+'</div>':'<div class="empty">Nessun giocatore in panchina registrato.</div>')+
  '<p class="subnote">Il rating mostra esclusivamente la media dei voti della partita. Le icone riportano gli eventi individuali registrati.</p></section>';
}
