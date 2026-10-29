import {parseCallupMessage} from './callup-message.js';
import {rpc,get,publishOfficialCallups} from './api.js';
const reasons=[['illness','Malattia'],['injury','Infortunio'],['suspension','Squalifica'],['personal','Assenza giocatore'],['technical_choice','Scelta tecnica']];
const allowed=ctx=>['admin','manager','coach','player'].includes(ctx.state.identity?.role?.role)&&ctx.state.identity?.profile?.is_active!==false;
export function installCallupMessageImport(getContext){
 document.addEventListener('click',async e=>{
  const button=e.target.closest('[data-callup-import-action]');if(!button)return;
  const ctx=getContext();
  if(!allowed(ctx))return;
  const form=document.querySelector('form[data-staff-form="callups"]');
  const output=document.querySelector('[data-callup-preview]');
  if(!form||!output)return;
  const roster=[...form.querySelectorAll('[data-callup-player]')].map(row=>{
   const player=(ctx.state.data?.players||[]).find(p=>p.id===row.dataset.callupPlayer)||{};
   return {...player,id:row.dataset.callupPlayer,locked:row.dataset.locked==='true'};
  });
  const match=ctx.resolveMatch().operational;
  if(match?.status!=='scheduled'){output.textContent='Importazione consentita solo prima della partita.';return}
  if(button.dataset.callupImportAction==='preview'){
   if((ctx.state.matchData?.players||[]).some(p=>p.started||['starter','bench'].includes(p.selection_status)||Number(p.minutes_played)>0)){output.textContent='La formazione è già stata inserita. Per evitare di alterarla, modifica le disponibilità manualmente.';return}
   const result=parseCallupMessage(document.querySelector('[data-callup-message]')?.value,roster);
   output.replaceChildren();
   const problem=result.error||[...result.unknown,...result.ambiguous].join(', ');
   if(problem){const el=document.createElement('p');el.className='data-warning';el.textContent='Lista non valida. '+problem;output.append(el);return}
   const included=new Set(result.matched.map(p=>p.id));
   if(roster.some(p=>p.locked&&!included.has(p.id))){output.textContent='Esclusione incompatibile con giocatori già scesi in campo.';return}
   const summary=document.createElement('p');summary.textContent='Convocati: '+result.matched.map(p=>p.label).join(', ');output.append(summary);
   for(const p of roster.filter(p=>!included.has(p.id))){
    const label=document.createElement('label');label.className='staff-field';label.textContent=[p.last_name,p.first_name].filter(Boolean).join(' ')+' · Motivazione';
    const select=document.createElement('select');select.dataset.importPlayer=p.id;
    const empty=document.createElement('option');empty.value='';empty.textContent='Seleziona motivo';select.append(empty);
    for(const [key,name] of reasons){const opt=document.createElement('option');opt.value=key;opt.textContent=name;select.append(opt)}
    label.append(select);output.append(label);
   }
   const submit=document.createElement('button');submit.type='button';submit.className='staff-submit';submit.dataset.callupImportAction='save';submit.dataset.included=JSON.stringify([...included]);submit.textContent='Conferma e salva convocazioni';output.append(submit);
   return;
  }
  if(button.dataset.callupImportAction!=='save')return;
  const matchId=form.dataset.callupMatch, included=new Set(JSON.parse(button.dataset.included||'[]'));
  const selected=[...output.querySelectorAll('select[data-import-player]')];
  if(selected.some(s=>!s.value)||selected.length+included.size!==roster.length){ctx.toast('Indica la motivazione per ogni escluso');return}
  const rows=roster.map(p=>({player_id:p.id,selection_status:included.has(p.id)?'available':'absent',unavailability_reason:included.has(p.id)?null:selected.find(s=>s.dataset.importPlayer===p.id)?.value}));
  if(rows.some(r=>r.selection_status==='absent'&&!r.unavailability_reason))return;
  button.disabled=true;
  try{
   const existing=await get('app_match_players','select=selection_status,started,minutes_played&match_id=eq.'+encodeURIComponent(matchId)+'&limit=200');
   if(existing.some(p=>p.started||['starter','bench'].includes(p.selection_status)||Number(p.minutes_played)>0))throw Error('Formazione già inserita: importazione bloccata');
   await rpc('tm_app_save_callups',{p_match_id:matchId,p_rows:rows});
   const saved=await get('app_match_players','select=player_id,selection_status,unavailability_reason&match_id=eq.'+encodeURIComponent(matchId)+'&limit=200');
   if(rows.some(r=>!saved.some(s=>s.player_id===r.player_id&&s.selection_status===r.selection_status&&(s.unavailability_reason||null)===(r.unavailability_reason||null))))throw Error('Verifica dei dati salvati non riuscita');
   let aiPublished=true;
   try{await publishOfficialCallups(matchId)}catch(error){
    aiPublished=false;console.warn('Convocazioni salvate, ma pubblicazione AI non registrata:',error);
   }
   await ctx.reloadAll();
   ctx.state.matchData=await ctx.loadMatchInfo(matchId);
   ctx.render();
   ctx.toast('Convocati importati: '+included.size+' · esclusi: '+selected.length+(aiPublished?'':' · Aggiornamento AI non registrato'));
  }catch(error){button.disabled=false;ctx.toast('Importazione non salvata: '+error.message)}
 });
}
