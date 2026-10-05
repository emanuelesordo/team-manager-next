import {matchPlayerLabel} from './match-player-label.js';
import {rpc} from './api.js';
import {votablePlayerIds,ratingSummary,parseVote} from './vote-domain.js';
import {playerMatchEvents} from './match-overview.js';
import {shirtSvg} from './kit-editor.js';

export async function saveVote(matchId,playerId,value){
 if(!matchId||!playerId)throw Error('Partita o giocatore non disponibile');
 return rpc('tm_app_save_rating',{p_match_id:matchId,p_player_id:playerId,p_rating:parseVote(value)});
}
export async function deleteVote(matchId,playerId){
 if(!matchId||!playerId)throw Error('Partita o giocatore non disponibile');
 return rpc('tm_app_delete_rating',{p_match_id:matchId,p_player_id:playerId});
}

function roleRank(player,row){
 const role=String(player?.generic_role_manual||row?.role||row?.generic_role_manual||'').toLowerCase();
 if(/^(p|por)|port|goal|gk/.test(role))return 0;
 if(/^(d|dif)|def|terzin|centrale|libero/.test(role))return 1;
 if(/^(c|cen)|mid|med|mezz|estern/.test(role))return 2;
 if(/^(a|att)|forw|punta|ala/.test(role))return 3;
 return 4;
}
function votePosition(value){
 const n=Math.max(1,Math.min(10,Number(value)||6));
 return ((n-1)/9*100).toFixed(3)+'%';
}
function roleLabel(player,row){
 return player?.generic_role_manual||row?.role||row?.generic_role_manual||'Giocatore';
}
function eventIcon(kind){
 if(kind==='goal')return '<span class="vote-event vote-event-goal" title="Gol">⚽</span>';
 if(kind==='own_goal')return '<span class="vote-event vote-event-own" title="Autogol">AG</span>';
 if(kind==='assist')return '<span class="vote-event vote-event-assist" title="Assist">A</span>';
 if(kind==='yellow_card')return '<span class="vote-event-card yellow" title="Ammonizione"></span>';
 if(kind==='blue_card')return '<span class="vote-event-card blue" title="Cartellino blu"></span>';
 if(kind==='double_card')return '<span class="vote-event-double" title="Doppia sanzione"><i></i><b></b></span>';
 if(kind==='red_card')return '<span class="vote-event-card red" title="Espulsione"></span>';
 return '';
}
function participation(row,events,match,competition){
 const nominal=Math.max(0,Number(competition?.periods||match?.periods_override||2)*Number(competition?.minutes_per_period||match?.minutes_per_period_override||40));
 const transitions=events.filter(x=>x.kind==='sub_in'||x.kind==='sub_out').sort((a,b)=>(a.minute??999)-(b.minute??999));
 let active=row.started===true||row.selection_status==='starter';
 let start=active?0:null,total=0;
 for(const ev of transitions){
  const minute=Number(ev.minute);
  if(!Number.isFinite(minute))continue;
  if(ev.kind==='sub_in'&&!active){start=minute;active=true}
  else if(ev.kind==='sub_out'&&active){total+=Math.max(0,minute-(start??0));active=false;start=null}
 }
 if(active&&nominal>0)total+=Math.max(0,nominal-(start??0));
 const inEvents=transitions.filter(x=>x.kind==='sub_in');
 const outEvents=transitions.filter(x=>x.kind==='sub_out');
 const flow=transitions.map(x=>'<span class="vote-flow '+(x.kind==='sub_in'?'in':'out')+'">'+(x.kind==='sub_in'?'↑':'↓')+' '+String(x.time||'—')+'</span>').join('');
 return {minutes:Math.round(total),flow,inEvents,outEvents};
}

export function votesPanel({match,data,people,userId,loggedIn,escape:e,competition=null,kit=null}){
 if(!match)return '<div class="empty padded">Tabellino operativo non disponibile: impossibile attribuire valutazioni.</div>';
 const rows=data?.players||[],events=data?.events||[],ratings=data?.ratings||[],aggregates=data?.ratingMeans||[];
 const eligible=votablePlayerIds(rows,events);
 const roster=rows.filter(row=>row.player_id&&row.selection_status!=='absent').map(row=>{
  const player=people.find(p=>p.id===row.player_id);
  if(!player)return null;
  const entered=eligible.has(row.player_id);
  const starter=row.started===true||row.selection_status==='starter';
  return {row,player,entered,starter,unused:!entered};
 }).filter(Boolean).sort((a,b)=>{
  const ga=a.starter?0:a.entered?1:2,gb=b.starter?0:b.entered?1:2;
  return ga-gb||
   roleRank(a.player,a.row)-roleRank(b.player,b.row)||
   Number(a.row.tactical_slot??999)-Number(b.row.tactical_slot??999)||
   Number(a.row.shirt_number??999)-Number(b.row.shirt_number??999)||
   String(a.player.last_name||'').localeCompare(String(b.player.last_name||''),'it');
 });
 const finished=match.status==='finished';
 const enteredCount=roster.filter(x=>x.entered).length;
 const intro='<div class="votes-intro"><div><span class="eyebrow">VALUTAZIONI</span><h3>Pagelle della partita</h3><p>Voto automatico al rilascio · scala 1–10 con mezzi punti.</p></div><span class="votes-pill">'+enteredCount+' valutabili</span></div>';
 if(!roster.length)return intro+'<div class="empty padded">Nessun giocatore nella formazione registrata.</div>';
 const banner=!finished?'<p class="vote-notice">I voti saranno disponibili al termine ufficiale della partita.</p>':
  !loggedIn?'<div class="vote-notice">Accedi per esprimere il tuo voto.<button data-action="account" type="button" class="soft-btn">Accedi</button></div>':'';
 const cards=roster.map(({player,row,entered,starter,unused})=>{
  const id=player.id,group=ratings.filter(x=>x.player_id===id),agg=aggregates.find(x=>x.player_id===id);
  const stats=agg?{count:Number(agg.votes||0),sv:Number(agg.sv||0),average:agg.avg_rating==null?null:Number(agg.avg_rating)}:ratingSummary(group);
  const personal=loggedIn?group.find(x=>x.voter_id===userId):undefined;
  const personalExists=Boolean(personal);
  const personalIsSv=personalExists&&(personal.rating===null||personal.rating===undefined);
  const personalValue=personalExists&&!personalIsSv?Number(personal.rating):null;
  const average=stats.count&&Number.isFinite(stats.average)?Number(stats.average):null;
  const averageText=average!==null?average.toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';
  const fullName=matchPlayerLabel(player);
  const canVote=finished&&loggedIn&&entered;
  const initial=personalValue??6;
  const stateClass=personalValue!==null?' has-vote':personalIsSv?' is-sv':' is-unrated';
  const playerEvents=playerMatchEvents(id,events,competition);
  const played=participation(row,playerEvents,match,competition);
  const visibleEvents=playerEvents.filter(x=>!['sub_in','sub_out','blue_return'].includes(x.kind));
  const eventMarkup=visibleEvents.length?visibleEvents.map(x=>{
   let kind=x.kind;
   if(kind==='second_yellow')kind='double_card';
   return '<span class="vote-event-item">'+eventIcon(kind)+'<small>'+e(x.time||'')+'</small></span>';
  }).join(''):'<span class="vote-events-empty">—</span>';
  const meanMarker=average!==null?'<i class="vote-mean-marker" style="--vote-mean:'+votePosition(average)+'" title="Media '+e(averageText)+'"></i>':'';
  const control=canVote?
   '<div class="vote-control'+stateClass+'" data-vote-control>'+
    '<div class="vote-scale"><div class="vote-track" aria-hidden="true"><span class="vote-six-marker"><b>6</b></span>'+meanMarker+'</div>'+
     '<input class="vote-range" data-vote-range data-vote-player="'+e(id)+'" data-vote-saved-value="'+(personalValue!==null?e(personalValue):'')+'" type="range" min="1" max="10" step="0.5" value="'+e(initial)+'" aria-label="Voto per '+e(fullName)+'" style="--vote-pos:'+votePosition(initial)+'">'+
     '<output class="vote-bubble" data-vote-bubble style="--vote-pos:'+votePosition(initial)+'">'+e(String(initial).replace('.',','))+'</output></div>'+
    '<div class="vote-actions">'+
      '<button type="button" class="vote-action'+(personalIsSv?' active':'')+'" data-vote-sv data-vote-player="'+e(id)+'">SV</button>'+
      (personalExists?'<button type="button" class="vote-action vote-clear" data-vote-clear data-vote-player="'+e(id)+'" aria-label="Annulla il voto">×</button>':'')+
    '</div>'+
    '<small class="vote-save-state" data-vote-save-state>'+(personalValue!==null?'Il tuo voto '+e(String(personalValue).replace('.',',')):personalIsSv?'Il tuo voto SV':'Tocca la barra o scegli SV')+'</small>'+
   '</div>':
   '<div class="vote-control is-disabled"><div class="vote-track" aria-hidden="true">'+meanMarker+'</div><small class="vote-save-state">'+(unused?'Non applicabile':'Non disponibile')+'</small></div>';
  const ratingLevel=average===null?'unrated':average>=9?'elite':average>=8?'high':average>=7?'above':average>=6?'even':average>=5?'below':'low';
  const avgLabel='<span class="ov-rating ov-rating-'+ratingLevel+(average===null?' ov-no-rating':'')+'" title="'+(stats.count?e('Voto medio partita: '+averageText+' ('+stats.count+' voti'+(stats.sv?' · '+stats.sv+' SV':'')+')'):'Nessun voto registrato')+'">'+e(averageText)+'</span>';
  const shirt='<span class="vote-shirt">'+shirtSvg(kit||{},'vote-'+id,false,row.shirt_number)+'<b>'+e(row.shirt_number??'—')+'</b></span>';
  return '<article class="vote-row'+(unused?' vote-row-unused':'')+'">'+
   '<div class="vote-shirt-cell">'+shirt+'</div>'+
   '<div class="vote-flow-cell">'+(played.flow||'<span class="vote-flow none">—</span>')+'</div>'+
   '<div class="vote-name-cell"><strong>'+e(fullName)+'</strong><small>'+e(String(played.minutes))+'′ · '+e(roleLabel(player,row))+'</small></div>'+
   '<div class="vote-events-cell">'+eventMarkup+'</div>'+
   '<div class="vote-bar-cell">'+control+'</div>'+
   '<div class="vote-average-cell">'+avgLabel+'</div>'+
   '</article>';
 }).join('');
 return intro+banner+'<div class="vote-scroll"><div class="vote-list">'+cards+'</div></div>';
}
