/* Bulk role editor: click order defines the natural position and defaults for additional roles. */
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;':'&quot;',"'":'&#39;'}[c]));
const defaults=[80,70,50,40,30,20,10,5];
export function roleSelection(existing=[],clicked){
 const roles=existing.map(x=>({...x}));
 const at=roles.findIndex(x=>x.code===clicked);
 if(at>=0){roles.splice(at,1);if(at===0&&roles.length)roles[0]={...roles[0],affinity:100,natural:true};return roles.map((x,i)=>({...x,natural:i===0,affinity:i===0?100:x.affinity===100?defaults[Math.min(i-1,defaults.length-1)]:x.affinity}))}
 roles.push({code:clicked,affinity:roles.length===0?100:defaults[Math.min(roles.length-1,defaults.length-1)],natural:roles.length===0});
 return roles;
}
export function roleRows(ctx){
 const d=ctx.state.data||{},roster=d.roster||[],positions=d.rolePositions||[];
 const catalog=new Map(positions.map(p=>[p.id,p.code]));
 const players=(d.players||[]).filter(p=>roster.some(r=>r.player_id===p.id&&r.season_id===ctx.state.season));
 return players.sort((a,b)=>String(a.last_name||'').localeCompare(String(b.last_name||''),'it')).map(p=>({
  id:p.id,name:[p.last_name,p.first_name].filter(Boolean).join(' '),
  roles:(d.roleAffinities||[]).filter(a=>a.player_id===p.id&&catalog.has(a.position_id)).map(a=>({code:catalog.get(a.position_id),affinity:a.affinity_pct,natural:a.is_natural})).sort((a,b)=>Number(b.natural)-Number(a.natural)||b.affinity-a.affinity)
 }));
}
export function renderRosterRoles(ctx){
 const positions=(ctx.state.data?.rolePositions||[]).filter(x=>x.active!==false);
 const players=roleRows(ctx);
 return '<section class="glass panel staff-editor staff-roles-matrix"><div class="staff-roles-head"><h3>Ruoli della rosa</h3><p>Seleziona le etichette in ordine: primo ruolo naturale (100%), poi 80%, 70%, 50%… Clicca ancora per rimuovere. Le percentuali si possono modificare qui.</p></div><div class="staff-roles-scroll"><div class="staff-roles-list">'+players.map(p=>{
  const selected=new Map(p.roles.map((x,i)=>[x.code,{...x,index:i}]));
  return '<div class="staff-roles-player" data-role-player="'+esc(p.id)+'"><strong>'+esc(p.name)+'</strong><div class="staff-roles-options">'+positions.map(pos=>{
   const item=selected.get(pos.code);
   return '<button type="button" class="staff-role-chip'+(item?' selected':'')+(item?.natural?' natural':'')+'" data-role-toggle="'+esc(pos.code)+'" data-role-id="'+esc(p.id)+'" title="'+esc(pos.label)+'" aria-pressed="'+Boolean(item)+'">'+esc(pos.code)+(item?'<small>'+item.affinity+'%</small>':'')+'</button>';
  }).join('')+'</div><div class="staff-roles-percentages">'+p.roles.map((r,i)=>'<label>'+esc(r.code)+' <input type="number" min="'+(i===0?100:0)+'" max="'+(i===0?100:100)+'" step="1" value="'+r.affinity+'" data-role-percent="'+esc(r.code)+'" data-role-id="'+esc(p.id)+'"'+(i===0?' readonly':'')+' aria-label="Affinità '+esc(r.code)+' '+esc(p.name)+'">%</label>').join('')+'</div><button type="button" class="staff-soft staff-role-save" data-role-save="'+esc(p.id)+'">Salva</button></div>';
 }).join('')+'</div></div></section>';
}
export function readRoleRow(element,positions){
 const chips=[...element.querySelectorAll('[data-role-toggle].selected')];
 const codes=new Set(positions.filter(x=>x.active!==false).map(x=>x.code));
 return chips.map((chip,i)=>{
  const code=chip.dataset.roleToggle;
  if(!codes.has(code))throw Error('Ruolo non riconosciuto');
  const input=element.querySelector('[data-role-percent="'+code+'"]');
  const affinity=i===0?100:Number(input?.value);
  if(!Number.isInteger(affinity)||affinity<0||affinity>100)throw Error('Affinità non valida per '+code);
  return {code,affinity,natural:i===0};
 });
}
export function bindRoleMatrix(ctx){
 const root=document.querySelector('.staff-roles-matrix');
 if(!root||root.dataset.bound)return;
 root.dataset.bound='1';
 root.addEventListener('click',async event=>{
  const chip=event.target.closest('[data-role-toggle]'),save=event.target.closest('[data-role-save]');
  if(chip){
   const row=chip.closest('[data-role-player]');
   const current=[...row.querySelectorAll('[data-role-toggle].selected')].map(x=>({code:x.dataset.roleToggle,affinity:Number(row.querySelector('[data-role-percent="'+x.dataset.roleToggle+'"]')?.value)||100,natural:x.classList.contains('natural')}));
   const next=roleSelection(current,chip.dataset.roleToggle);
   row.querySelectorAll('[data-role-toggle]').forEach(c=>{
    const item=next.find(x=>x.code===c.dataset.roleToggle);
    c.classList.toggle('selected',!!item);c.classList.toggle('natural',!!item?.natural);c.setAttribute('aria-pressed',String(!!item));
    c.innerHTML=esc(c.dataset.roleToggle)+(item?'<small>'+item.affinity+'%</small>':'');
    c.style.order=item?String(next.indexOf(item)):'';
   });
   row.querySelector('.staff-roles-percentages').innerHTML=next.map((r,i)=>'<label>'+esc(r.code)+' <input type="number" min="'+(i===0?100:0)+'" max="100" step="1" value="'+r.affinity+'" data-role-percent="'+esc(r.code)+'" data-role-id="'+esc(row.dataset.rolePlayer)+'"'+(i===0?' readonly':'')+'>%</label>').join('');
   row.dataset.dirty='1';return;
  }
  if(save){
   const row=save.closest('[data-role-player]'),roles=readRoleRow(row,ctx.state.data?.rolePositions||[]);
   if(!roles.length){ctx.toast('Seleziona almeno un ruolo naturale');return}
   save.disabled=true;
   try{await ctx.rpcSaveRoles(row.dataset.rolePlayer,roles);row.dataset.dirty='';ctx.toast('Ruoli salvati');}
   catch(err){ctx.toast('Errore: '+err.message)}finally{save.disabled=false}
  }
 });
 root.addEventListener('change',e=>{const input=e.target.closest('[data-role-percent]');if(!input)return;const row=input.closest('[data-role-player]');row.dataset.dirty='1';const chip=row.querySelector('[data-role-toggle="'+input.dataset.rolePercent+'"] small');if(chip)chip.textContent=input.value+'%'});
}
