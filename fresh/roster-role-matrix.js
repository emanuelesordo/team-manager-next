/* Bulk role editor: click order defines the natural position and defaults for additional roles. */
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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
  id:p.id,name:(String(p.first_name||'').trim()?String(p.first_name).trim().charAt(0).toLocaleUpperCase('it')+'. ':'')+String(p.last_name||'').trim(),
  roles:(d.roleAffinities||[]).filter(a=>a.player_id===p.id&&catalog.has(a.position_id)).map(a=>({code:catalog.get(a.position_id),affinity:a.affinity_pct,natural:a.is_natural})).sort((a,b)=>Number(b.natural)-Number(a.natural)||b.affinity-a.affinity)
 }));
}
export function renderRosterRoles(ctx){
 const positions=(ctx.state.data?.rolePositions||[]).filter(x=>x.active!==false);
 const players=roleRows(ctx);
 const headings='<div class="staff-roles-player staff-roles-column-head"><strong>Giocatore</strong><div class="staff-roles-options">'+positions.map(p=>'<span title="'+esc(p.label)+'">'+esc(p.code)+'</span>').join('')+'</div><span>Affinità</span><span></span></div>';
 return '<section class="staff-roles-matrix"><div class="staff-roles-head"><h3>Ruoli della rosa</h3><p>Primo ruolo: naturale (100%). Successivi: 80%, 70%, 50%… Seleziona le sigle e scorri la tabella per vedere tutte le posizioni.</p></div><div class="staff-roles-scroll"><div class="staff-roles-list">'+headings+players.map(p=>{
  const selected=new Map(p.roles.map((x,i)=>[x.code,{...x,index:i}]));
  return '<div class="staff-roles-player" data-role-player="'+esc(p.id)+'"><strong>'+esc(p.name)+'</strong><div class="staff-roles-options">'+positions.map(pos=>{
   const item=selected.get(pos.code);
   return '<button type="button" class="staff-role-chip'+(item?' selected':'')+(item?.natural?' natural':'')+'" data-role-toggle="'+esc(pos.code)+'" data-role-order="'+(item?item.index:-1)+'" data-role-id="'+esc(p.id)+'" title="'+esc(pos.label)+(item?' · '+item.affinity+'%':'')+'" aria-label="'+esc(pos.label)+' · '+esc(p.name)+'" aria-pressed="'+Boolean(item)+'">'+esc(pos.code)+'</button>';
  }).join('')+'</div><div class="staff-roles-percentages">'+p.roles.map((r,i)=>'<label>'+esc(r.code)+' <input type="number" min="'+(i===0?100:0)+'" max="100" step="1" value="'+r.affinity+'" data-role-percent="'+esc(r.code)+'" data-role-id="'+esc(p.id)+'"'+(i===0?' readonly':'')+'>%</label>').join('')+'</div><button type="button" class="staff-role-status" data-role-status="saved" aria-label="Salvataggio automatico" title="Salvataggio automatico" disabled>✓</button></div>';
 }).join('')+'</div></div></section>';
}
export function readRoleRow(element,positions){
 const chips=[...element.querySelectorAll('[data-role-toggle].selected')].sort((a,b)=>Number(a.dataset.roleOrder)-Number(b.dataset.roleOrder));
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
/** Serial writes per player and retain failed changes for explicit retry. */
export function createRoleAutosaver(save,notify=()=>{}){
 const jobs=new Map();
 async function flush(id,job){
  job.busy=true;
  while(job.pending){
   const roles=job.pending;
   job.pending=null;
   try{
    await save(id,roles);
    if(!job.pending)notify(id,'saved',roles);
   }catch(error){
    job.pending=job.pending||roles;
    notify(id,'error',error);
    break;
   }
  }
  job.busy=false;
 }
 return {
  enqueue(id,roles){
   let job=jobs.get(id);
   if(!job){job={busy:false,pending:null};jobs.set(id,job)}
   job.pending=roles.map(role=>({...role}));
   notify(id,'pending');
   if(!job.busy)void flush(id,job);
  },
  retry(id){
   const job=jobs.get(id);
   if(job?.pending&&!job.busy){notify(id,'pending');void flush(id,job)}
  }
 };
}
export function bindRoleMatrix(ctx){
 const root=document.querySelector('.staff-roles-matrix');
 if(!root||root.dataset.bound)return;
 root.dataset.bound='1';
 const positions=ctx.state.data?.rolePositions||[];
 const timers=new Map();
 function rowById(id){return [...root.querySelectorAll('[data-role-player]')].find(row=>row.dataset.rolePlayer===id)}
 function show(id,status){
  const row=rowById(id),indicator=row?.querySelector('[data-role-status]');
  if(!indicator)return;
  indicator.dataset.roleStatus=status;
  indicator.textContent=status==='pending'?'…':status==='saved'?'✓':'!';
  indicator.title=status==='pending'?'Salvataggio in corso':status==='saved'?'Modifiche salvate':'Salvataggio fallito: tocca ! per riprovare';
  indicator.setAttribute('aria-label',indicator.title);
  indicator.disabled=status!=='error';
  row.dataset.dirty=status!=='saved'?'1':'';
 }
 const autosaver=createRoleAutosaver(async(id,roles)=>{
  await ctx.rpcSaveRoles(id,roles);
  const ids=new Map(positions.map(p=>[p.code,p.id]));
  const previous=ctx.state.data?.roleAffinities||[];
  ctx.state.data.roleAffinities=[
   ...previous.filter(r=>r.player_id!==id),
   ...roles.filter(r=>ids.has(r.code)).map(r=>({player_id:id,position_id:ids.get(r.code),affinity_pct:r.affinity,is_natural:r.natural}))
  ];
 },(id,status)=>show(id,status));
 function persist(row){
  if(!row)return;
  const id=row.dataset.rolePlayer;
  clearTimeout(timers.get(id));timers.delete(id);
  try{
   const roles=readRoleRow(row,positions);
   if(!roles.length){ctx.toast('È necessario un ruolo naturale');return}
   autosaver.enqueue(id,roles);
  }catch(error){show(id,'error');ctx.toast('Affinità: '+error.message)}
 }
 root.addEventListener('click',event=>{
  const retry=event.target.closest('[data-role-status="error"]');
  if(retry){autosaver.retry(retry.closest('[data-role-player]').dataset.rolePlayer);return}
  const chip=event.target.closest('[data-role-toggle]');if(!chip)return;
  const row=chip.closest('[data-role-player]');
  const current=[...row.querySelectorAll('[data-role-toggle].selected')]
   .sort((a,b)=>Number(a.dataset.roleOrder)-Number(b.dataset.roleOrder))
   .map(x=>({code:x.dataset.roleToggle,affinity:Number(row.querySelector('[data-role-percent="'+x.dataset.roleToggle+'"]')?.value??100),natural:x.classList.contains('natural')}));
  const next=roleSelection(current,chip.dataset.roleToggle);
  if(!next.length){ctx.toast('È necessario un ruolo naturale');return}
  row.querySelectorAll('[data-role-toggle]').forEach(c=>{
   const item=next.find(x=>x.code===c.dataset.roleToggle);
   c.classList.toggle('selected',!!item);c.classList.toggle('natural',!!item?.natural);
   c.setAttribute('aria-pressed',String(!!item));
   c.textContent=c.dataset.roleToggle;
   c.dataset.roleOrder=item?String(next.indexOf(item)):'-1';
   c.title=c.dataset.roleToggle+(item?' · '+item.affinity+'%':'');
  });
  row.querySelector('.staff-roles-percentages').innerHTML=next.map((r,i)=>
   '<label>'+esc(r.code)+' <input type="number" min="'+(i===0?100:0)+'" max="100" step="1" value="'+r.affinity+
   '" data-role-percent="'+esc(r.code)+'" data-role-id="'+esc(row.dataset.rolePlayer)+'"'+(i===0?' readonly':'')+'>%</label>'
  ).join('');
  persist(row);
 });
 root.addEventListener('input',event=>{
  const input=event.target.closest('[data-role-percent]');if(!input)return;
  const row=input.closest('[data-role-player]'),id=row.dataset.rolePlayer;
  const chip=row.querySelector('[data-role-toggle="'+input.dataset.rolePercent+'"]');
  if(chip)chip.title=chip.dataset.roleToggle+' · '+input.value+'%';
  clearTimeout(timers.get(id));
  show(id,'pending');
  timers.set(id,setTimeout(()=>persist(row),450));
 });
 root.addEventListener('change',event=>{
  const input=event.target.closest('[data-role-percent]');if(input)persist(input.closest('[data-role-player]'));
 });
 root.addEventListener('focusout',event=>{
  const input=event.target.closest('[data-role-percent]');
  if(input&&timers.has(input.dataset.roleId))persist(input.closest('[data-role-player]'));
 });
}
