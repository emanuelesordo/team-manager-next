import {rpc} from './api.js';
import {votablePlayerIds,ratingSummary,parseVote} from './vote-domain.js';
export async function saveVote(matchId,playerId,value){
 if(!matchId||!playerId)throw Error('Partita o giocatore non disponibile');
 return rpc('tm_app_save_rating',{p_match_id:matchId,p_player_id:playerId,p_rating:parseVote(value)});
}
export function votesPanel({match,data,people,userId,loggedIn,escape:e}){
 if(!match)return '<div class="empty padded">Tabellino operativo non disponibile: impossibile attribuire valutazioni.</div>';
 const rows=data?.players||[],events=data?.events||[],ratings=data?.ratings||[];
 const eligible=votablePlayerIds(rows,events);
 const names=[...eligible].map(id=>people.find(p=>p.id===id)).filter(Boolean).sort((a,b)=>String(a.last_name||'').localeCompare(String(b.last_name||''),'it'));
 const finished=match.status==='finished';
 const intro='<div class="votes-intro"><div><span class="eyebrow">VALUTAZIONI</span><h3>Pagelle della partita</h3><p>Voti da 1 a 10, inclusi mezzi punti. SV non entra nella media.</p></div><span class="votes-pill">'+names.length+' giocatori entrati</span></div>';
 if(!names.length)return intro+'<div class="empty padded">Nessun titolare o subentrato certificato. I convocati inutilizzati non vengono valutati.</div>';
 const banner=!finished?'<p class="vote-notice">I voti saranno disponibili al termine ufficiale della partita.</p>':
  !loggedIn?'<div class="vote-notice">Accedi per esprimere il tuo voto.<button data-action="account" type="button" class="soft-btn">Accedi</button></div>':'';
 const cards=names.map(player=>{
  const id=player.id,group=ratings.filter(row=>row.player_id===id),stats=ratingSummary(group);
  const personal=loggedIn?group.find(row=>row.voter_id===userId):undefined;
  const display=stats.count?stats.average.toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';
  const fullName=String(player.first_name||'')+' '+String(player.last_name||'');
  const options=['<option value="" disabled'+(personal?'':' selected')+'>Seleziona</option>'];
  for(let n=1;n<=10;n+=0.5)options.push('<option value="'+n+'"'+(personal&&personal.rating!==null&&Number(personal.rating)===n?' selected':'')+'>'+n.toLocaleString('it-IT')+'</option>');
  options.push('<option value="SV"'+(personal&&personal.rating===null?' selected':'')+'>SV · Senza voto</option>');
  const input=finished&&loggedIn?'<form data-vote-form data-vote-player="'+e(id)+'" class="vote-form"><label for="vote-'+e(id)+'">Il tuo voto</label><div><select id="vote-'+e(id)+'" name="rating" required>'+options.join('')+'</select><button class="staff-submit" type="submit">'+(personal?'Aggiorna':'Salva')+'</button></div></form>':'';
  return '<article class="vote-card"><div class="vote-identity"><span class="vote-avatar">'+e((player.first_name||'?')[0]+(player.last_name||'?')[0]).toUpperCase()+'</span><div><strong>'+e(fullName)+'</strong><small>'+e(player.generic_role_manual||'Giocatore')+'</small></div></div><div class="vote-average"><b>'+e(display)+'</b><small>Media · '+stats.count+' voti'+(stats.sv?' · '+stats.sv+' SV':'')+'</small></div>'+input+(finished&&loggedIn?'<small class="vote-personal">'+e(personal?'Il tuo voto: '+(personal.rating===null?'SV':personal.rating):'Non hai ancora votato')+'</small>':'')+'</article>';
 }).join('');
 return intro+banner+'<div class="vote-grid">'+cards+'</div>';
}
