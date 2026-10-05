import {matchPlayerLabel} from './match-player-label.js';
import {rpc} from './api.js';
import {votablePlayerIds,ratingSummary,parseVote} from './vote-domain.js';

export async function saveVote(matchId,playerId,value){
 if(!matchId||!playerId)throw Error('Partita o giocatore non disponibile');
 return rpc('tm_app_save_rating',{p_match_id:matchId,p_player_id:playerId,p_rating:parseVote(value)});
}

function roleRank(player,row){
 const role=String(player?.generic_role_manual||row?.role||row?.generic_role_manual||'').toLowerCase();
 if(/port|goal|gk/.test(role))return 0;
 if(/dif|def|terzin|centrale|libero/.test(role))return 1;
 if(/centro|mid|med|mezz|estern/.test(role))return 2;
 if(/att|forw|punta|ala/.test(role))return 3;
 return 4;
}
function votePosition(value){
 const n=Math.max(1,Math.min(10,Number(value)||6));
 return ((n-1)/9*100).toFixed(3)+'%';
}
function roleLabel(player,row){
 return player?.generic_role_manual||row?.role||row?.generic_role_manual||'Giocatore';
}

export function votesPanel({match,data,people,userId,loggedIn,escape:e}){
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
 const intro='<div class="votes-intro"><div><span class="eyebrow">VALUTAZIONI</span><h3>Pagelle della partita</h3><p>Voti da 1 a 10, inclusi mezzi punti. Il voto viene salvato automaticamente.</p></div><span class="votes-pill">'+enteredCount+' giocatori valutabili</span></div>';
 if(!roster.length)return intro+'<div class="empty padded">Nessun giocatore nella formazione registrata.</div>';
 const banner=!finished?'<p class="vote-notice">I voti saranno disponibili al termine ufficiale della partita.</p>':
  !loggedIn?'<div class="vote-notice">Accedi per esprimere il tuo voto.<button data-action="account" type="button" class="soft-btn">Accedi</button></div>':'';
 const cards=roster.map(({player,row,entered,starter,unused})=>{
  const id=player.id,group=ratings.filter(x=>x.player_id===id),agg=aggregates.find(x=>x.player_id===id);
  const stats=agg?{count:Number(agg.votes||0),sv:Number(agg.sv||0),average:agg.avg_rating==null?null:Number(agg.avg_rating)}:ratingSummary(group);
  const personal=loggedIn?group.find(x=>x.voter_id===userId):undefined;
  const personalValue=personal&&personal.rating!==null&&personal.rating!==undefined?Number(personal.rating):null;
  const average=stats.count&&Number.isFinite(stats.average)?Number(stats.average):null;
  const averageText=average!==null?average.toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';
  const fullName=matchPlayerLabel(player);
  const canVote=finished&&loggedIn&&entered;
  const initial=personalValue??6;
  const stateClass=personalValue!==null?' has-vote':' is-unrated';
  const groupLabel=starter?'Titolare':entered?'Subentrato':'Non entrato';
  const meanMarker=average!==null?'<i class="vote-mean-marker" style="--vote-mean:'+votePosition(average)+'" title="Media '+e(averageText)+'"></i>':'';
  const control=canVote?
   '<div class="vote-control'+stateClass+'" data-vote-control>'+
    '<div class="vote-scale">'+
     '<div class="vote-track" aria-hidden="true">'+
      '<span class="vote-six-marker"><b>6</b></span>'+meanMarker+
     '</div>'+
     '<input class="vote-range" data-vote-range data-vote-player="'+e(id)+'" type="range" min="1" max="10" step="0.5" value="'+e(initial)+'" aria-label="Voto per '+e(fullName)+'" style="--vote-pos:'+votePosition(initial)+'">'+
     '<output class="vote-bubble" data-vote-bubble style="--vote-pos:'+votePosition(initial)+'">'+e(String(initial).replace('.',','))+'</output>'+
    '</div>'+
    '<div class="vote-meta"><span data-vote-save-state>'+(personalValue!==null?'Il tuo voto '+e(String(personalValue).replace('.',',')):'Tocca la barra per votare')+'</span><span>Media '+e(averageText)+(stats.count?' · '+stats.count+' voti':'')+'</span></div>'+
   '</div>':
   '<div class="vote-control is-disabled"><div class="vote-track" aria-hidden="true"><span class="vote-six-marker"><b>6</b></span>'+meanMarker+'</div><div class="vote-meta"><span>'+(unused?'Voto non applicabile':'Votazione non disponibile')+'</span><span>Media '+e(averageText)+(stats.count?' · '+stats.count+' voti':'')+(stats.sv?' · '+stats.sv+' SV':'')+'</span></div></div>';
  return '<article class="vote-row'+(unused?' vote-row-unused':'')+'">'+
   '<div class="vote-identity"><span class="vote-avatar">'+e(((player.first_name||'?')[0]+(player.last_name||'?')[0]).toUpperCase())+'</span><div><strong>'+e(fullName)+'</strong><small>'+e(roleLabel(player,row))+' · '+groupLabel+'</small></div></div>'+
   control+'</article>';
 }).join('');
 return intro+banner+'<div class="vote-list">'+cards+'</div>';
}
