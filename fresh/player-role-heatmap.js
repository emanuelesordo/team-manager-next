/* Player position fit is an explicit staff assessment, not an observed event metric. */
export const POSITION_SPOTS=Object.freeze({
 POR:[50,89],DC:[50,75],BRD:[66,72],BRS:[34,72],TD:[87,71],TS:[13,71],
 QD:[92,50],QS:[8,50],ED:[78,53],ES:[22,53],MED:[50,57],CC:[50,45],
 MZD:[65,43],MZS:[35,43],TRQ:[50,30],AD:[81,26],AS:[19,26],SP:[38,19],ATT:[53,14]
});
const E=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validPct=value=>value!==null&&value!==undefined&&value!==''&&Number.isInteger(Number(value))&&Number(value)>=0&&Number(value)<=100;
export const groupForPosition=category=>({goalkeeper:'P',defender:'D',midfielder:'C',forward:'A'})[category]||null;
export function playerRoleProfile(playerId,affinities=[],positions=[]){
 const catalog=new Map((positions||[]).filter(x=>x.active!==false).map(x=>[String(x.id),x]));
 const rows=(affinities||[]).filter(x=>String(x.player_id)===String(playerId)).flatMap(row=>{
  const position=catalog.get(String(row.position_id));
  return position&&validPct(row.affinity_pct)?[{...position,affinity:Number(row.affinity_pct),natural:row.is_natural===true}]:[];
 });
 rows.sort((a,b)=>Number(b.natural)-Number(a.natural)||b.affinity-a.affinity||Number(a.sort_order)-Number(b.sort_order)||a.label.localeCompare(b.label,'it'));
 return {natural:rows.find(x=>x.natural&&x.affinity===100)||null,roles:rows};
}
function level(pct){return pct>=85?'excellent':pct>=70?'good':pct>=50?'adaptable':pct>=25?'emergency':'low'}
const levelLabel=pct=>pct>=85?'Molto affine':pct>=70?'Buona affinità':pct>=50?'Adattabile':pct>=25?'Emergenza':'Da evitare';
/** A visual pitch and a readable ordered list, never extrapolating unknown positions. */
export function renderPlayerRoleHeatmap(playerId,affinities=[],positions=[]){
 const {natural,roles}=playerRoleProfile(playerId,affinities,positions);
 if(!natural)return '<section class="psi-area psi-role-area"><div class="psi-area-head"><h2>Ruoli e affinità</h2><p>Valutazione manuale dello staff</p></div><p class="psi-role-empty">Ruolo naturale e compatibilità non ancora configurati.</p></section>';
 const configured=roles.filter(x=>POSITION_SPOTS[x.code]);
 const zones=configured.map(position=>{
  const [x,y]=POSITION_SPOTS[position.code],s=level(position.affinity);
  return '<div class="psi-role-spot '+s+(position.natural?' natural':'')+'" style="--role-x:'+x+'%;--role-y:'+y+'%;--role-strength:'+(0.25+position.affinity/100*.75).toFixed(2)+'" title="'+E(position.label)+' · '+position.affinity+'%" aria-label="'+E(position.label)+': '+position.affinity+'%'+(position.natural?' · Ruolo naturale':'')+'">'+
   '<span class="psi-role-glow"></span><span class="psi-role-pin"><b>'+E(position.code)+'</b><small>'+position.affinity+'%</small></span></div>';
 }).join('');
 const items=roles.map(position=>'<li class="psi-role-entry '+level(position.affinity)+(position.natural?' natural':'')+'"><div class="psi-role-description"><span class="psi-role-code">'+E(position.code)+'</span><div><strong>'+E(position.label)+'</strong><small>'+(position.natural?'Naturale · riferimento 100%':levelLabel(position.affinity))+'</small></div></div><div class="psi-role-affinity"><b>'+position.affinity+'%</b><span class="psi-role-meter"><i style="width:'+position.affinity+'%"></i></span></div></li>').join('');
 return '<section class="psi-area psi-role-area"><div class="psi-area-head"><h2>Ruoli e affinità</h2><p>Profilo configurato dallo staff · non è una statistica osservata</p></div>'+
 '<div class="psi-role-layout"><div class="psi-role-field-wrap"><div class="psi-role-field" aria-label="Mappa delle posizioni compatibili: portiere in basso, attacco in alto">'+
 '<div class="psi-role-pitch-outline"></div><div class="psi-role-midline"></div><div class="psi-role-circle"></div><div class="psi-role-box top"></div><div class="psi-role-box bottom"></div><div class="psi-role-goal top"></div><div class="psi-role-goal bottom"></div>'+zones+'</div>'+
 '<div class="psi-role-legend"><span><i class="excellent"></i>85–100%</span><span><i class="good"></i>70–84%</span><span><i class="adaptable"></i>50–69%</span><span><i class="emergency"></i>25–49%</span><span><i class="low"></i>0–24%</span></div></div>'+
 '<div class="psi-role-info"><div class="psi-role-natural"><small>RUOLO NATURALE</small><strong>'+E(natural.label)+'</strong><b>100%</b></div><ol class="psi-role-list">'+items+'</ol></div></div></section>';
}
/** Editor integrated in the existing staff player form. Unset percentages are genuinely unset. */
export function renderRoleAffinityEditor(playerId,affinities=[],positions=[]){
 const catalog=(positions||[]).filter(p=>p.active!==false&&POSITION_SPOTS[p.code]).sort((a,b)=>Number(a.sort_order)-Number(b.sort_order));
 if(!catalog.length)return '<p class="staff-help">Catalogo ruoli non disponibile: impossibile modificare le affinità.</p>';
 const {natural,roles}=playerRoleProfile(playerId,affinities,positions);
 const map=new Map(roles.map(x=>[x.code,x]));
 const options='<option value="">Da configurare</option>'+catalog.map(x=>'<option value="'+E(x.code)+'"'+(x.code===natural?.code?' selected':'')+'>'+E(x.label)+' ('+E(x.code)+')</option>').join('');
 const values=catalog.map(p=>'<label class="staff-role-affinity"><span title="'+E(p.label)+'"><b>'+E(p.code)+'</b> '+E(p.label)+'</span><input type="number" min="0" max="100" step="1" inputmode="numeric" name="affinity__'+E(p.code)+'" data-role-affinity-code="'+E(p.code)+'" value="'+(p.code===natural?.code?100:map.get(p.code)?.affinity??'')+'" placeholder="—" aria-label="Affinità '+E(p.label)+' in percentuale"'+(p.code===natural?.code?' readonly':'')+'><small>%</small></label>').join('');
 return '<fieldset class="staff-role-fieldset" data-role-editor><legend>Ruoli e affinità</legend><p class="staff-help">Definisci il ruolo naturale (sempre 100%) e le altre posizioni ricopribili. Lascia vuota una percentuale per escludere quel ruolo. Dati manuali, non derivati dai voti.</p>'+
  '<label class="staff-field"><span>Ruolo naturale</span><select name="natural_position" data-natural-position>'+options+'</select></label>'+
  '<div class="staff-role-affinities">'+values+'</div></fieldset>';
}
/** Read only entries deliberately configured; a blank editor does not erase older data. */
export function collectRoleAffinityForm(form,positions=[]){
 const sel=form?.elements?.namedItem?.('natural_position');
 if(!sel)return null;
 const natural=String(sel.value||'');
 const catalog=(positions||[]).filter(x=>x.active!==false&&POSITION_SPOTS[x.code]);
 const codes=new Set(catalog.map(x=>x.code));
 if(natural&&!codes.has(natural))throw Error('Seleziona un ruolo naturale valido');
 const rows=[];
 for(const position of catalog){
  const input=form.elements.namedItem('affinity__'+position.code);
  const raw=String(input?.value??'').trim();
  if(position.code===natural){rows.push({code:natural,affinity:100,natural:true});continue}
  if(!raw)continue;
  if(!/^\d{1,3}$/.test(raw)||!validPct(raw))throw Error('Affinità non valida per '+position.label+': da 0 a 100');
  rows.push({code:position.code,affinity:Number(raw),natural:false});
 }
 if(!natural){
  if(rows.length)throw Error('Indica il ruolo naturale prima di inserire le altre affinità');
  return null;
 }
 return rows;
}
export function installRoleAffinityEditor(){
 if(typeof document==='undefined')return;
 document.addEventListener('change',event=>{
  if(!event.target.matches('[data-natural-position]'))return;
  const editor=event.target.closest('[data-role-editor]');if(!editor)return;
  const code=event.target.value;
  editor.querySelectorAll('[data-role-affinity-code]').forEach(input=>{
   if(input.dataset.roleAffinityCode===code){input.value='100';input.readOnly=true;}
   else input.readOnly=false;
  });
 });
 document.addEventListener('input',event=>{
  const input=event.target.closest('[data-role-affinity-code]');if(!input)return;
  const natural=input.closest('[data-role-editor]')?.querySelector('[data-natural-position]')?.value;
  if(natural===input.dataset.roleAffinityCode){input.value='100';input.readOnly=true;}
 });
}
