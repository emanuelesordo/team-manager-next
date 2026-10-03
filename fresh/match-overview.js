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
 const baselineRow=(seasonStats||[]).find(x=>x.player_id===playerId);
 const base=baselineRow?.avg_rating==null?null:Number(baselineRow.avg_rating);
 const difference=base!==null&&Number.isFinite(base)?score-base:null;
 const level=difference===null?'unrated':difference>=.75?'high':difference>=.2?'above':
  difference<=-.75?'low':difference<=-.2?'below':'even';
 return {score,baseline:base,difference,level,votes};
}
export function overviewLineup(match,matchData,people=[],seasonStats=[],competition=null){
 const roster=(matchData?.players||[]).filter(x=>x.selection_status!=='absent');
 const starters=roster.filter(x=>x.started||x.selection_status==='starter')
  .sort((a,b)=>(a.tactical_slot??99)-(b.tactical_slot??99)||(a.shirt_number??999)-(b.shirt_number??999));
 const bench=roster.filter(x=>!x.started&&x.selection_status==='bench')
  .sort((a,b)=>(a.shirt_number??999)-(b.shirt_number??999));
 const byId=new Map((people||[]).map(p=>[p.id,p]));
 const renderPlayer=row=>{
  const p=byId.get(row.player_id);
  const name=[p?.first_name,p?.last_name].filter(Boolean).join(' ')||'Giocatore';
  const rating=relativeRating(row.player_id,matchData,seasonStats);
  const events=playerMatchEvents(row.player_id,matchData?.events||[],competition);
  const eventMarkup=events.map(x=>'<span class="ov-event ov-'+escapeHtml(x.kind)+'" title="'+escapeHtml(x.name+' · '+x.time)+'" aria-label="'+escapeHtml(x.name+' '+x.time)+'">'+
    (['yellow_card','blue_card','red_card'].includes(x.kind)?'<i></i>':escapeHtml(x.label))+'</span>').join('');
  let ratingMarkup='<span class="ov-rating ov-no-rating" title="Nessun voto registrato">—</span>';
  if(rating){
   const diff=rating.difference;
   const diffText=diff===null?'':(diff>0?'+':'')+diff.toFixed(1).replace('.',',');
   const title='Voto partita: '+rating.score.toFixed(2)+' · Voto medio personale: '+
    (rating.baseline===null?'non disponibile':rating.baseline.toFixed(2))+
    (diff===null?'':' · Scarto '+diffText);
   ratingMarkup='<span class="ov-rating ov-rating-'+rating.level+'" title="'+escapeHtml(title)+'">'+
    rating.score.toFixed(1).replace('.',',')+(diff!==null?'<small>'+escapeHtml(diffText)+'</small>':'')+'</span>';
  }
  return '<div class="ov-player" data-player-id="'+escapeHtml(row.player_id)+'"><span class="ov-shirt">'+escapeHtml(row.shirt_number??'·')+'</span>'+
   '<span class="ov-player-name">'+escapeHtml(name)+(row.is_captain?' <small class="ov-captain">C</small>':'')+'</span>'+
   '<span class="ov-personal-events">'+eventMarkup+'</span>'+ratingMarkup+'</div>';
 };
 const rawFormation=String(match?.formation||'4-4-2').split('-').map(Number);
 const valid=rawFormation.length>=2&&rawFormation.length<=5&&rawFormation.every(x=>Number.isInteger(x)&&x>0)&&rawFormation.reduce((a,b)=>a+b,0)===10;
 const arrangement=valid?rawFormation:[4,4,2];
 let offset=1,lines=[];
 for(const qty of arrangement){lines.push(starters.slice(offset,offset+qty));offset+=qty}
 const rest=starters.slice(offset);
 // For an 11-player formation, render attack first and goalkeeper closest to the bottom.
 const pitchRows=[...lines.reverse(),starters.slice(0,1),...(rest.length?[rest]:[])];
 const pitch=pitchRows.map((line,index)=>'<div class="ov-pitch-line" data-line="'+index+'">'+line.map(renderPlayer).join('')+'</div>').join('');
 const label=match?.formation||'4-4-2';
 return '<section class="ov-lineup"><div class="ov-section-heading"><h3>Formazione titolare</h3><small>'+escapeHtml(label)+' · '+starters.length+' titolari</small></div>'+
  (starters.length?'<div class="ov-pitch" aria-label="Formazione iniziale">'+pitch+'</div>':'<div class="empty">Formazione iniziale non registrata.</div>')+
  '<div class="ov-section-heading ov-bench-heading"><h3>Panchina</h3><small>'+bench.length+' giocatori</small></div>'+
  (bench.length?'<div class="ov-bench">'+bench.map(renderPlayer).join('')+'</div>':'<div class="empty">Nessun giocatore in panchina registrato.</div>')+
  '<p class="subnote">Il voto è confrontato con la media personale stagionale, quando disponibile. Le icone riportano gli eventi individuali effettivamente registrati.</p></section>';
}
