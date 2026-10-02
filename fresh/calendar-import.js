import {rpc} from './api.js';
import {parseFixtureCSV} from './import-domain.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={competition:'',file:'',items:[],errors:[],remote:null,busy:false};
let provider=null,installed=false;
function button(action,label,disabled=false){return '<button type="button" data-import-action="'+action+'" class="staff-soft"'+(disabled?' disabled':'')+'>'+label+'</button>'}
export function importPanel(ctx){
 const competitions=ctx.state.data?.competitions||[];
 if(!state.competition||!competitions.some(c=>c.id===state.competition))state.competition=competitions[0]?.id||'';
 const options=competitions.map(c=>'<option value="'+esc(c.id)+'"'+(c.id===state.competition?' selected':'')+'>'+esc(c.name)+'</option>').join('');
 const errors=state.errors.length?'<div class="import-errors" role="alert"><b>Correggi queste righe:</b>'+
  state.errors.slice(0,12).map(e=>'<p>Riga '+Number(e.line)+': '+esc(e.message)+'</p>').join('')+(state.errors.length>12?'<p>Altri '+(state.errors.length-12)+' errori.</p>':'')+'</div>':'';
 const preview=state.items.length?'<div class="import-preview"><div class="import-counter"><strong>'+state.items.length+'</strong> righe valide'+(state.file?' · '+esc(state.file):'')+'</div>'+
  '<div class="table-scroller"><table class="standing-table"><thead><tr><th>G</th><th>Data</th><th>Casa</th><th>Ospite</th></tr></thead><tbody>'+
  state.items.slice(0,12).map(x=>'<tr><td>'+x.round_no+'</td><td>'+esc(new Date(x.kickoff_at).toLocaleString('it-IT',{timeZone:'Europe/Rome',dateStyle:'short',timeStyle:'short'}))+'</td><td>'+esc(x.home_team)+'</td><td>'+esc(x.away_team)+'</td></tr>').join('')+'</tbody></table></div>'+
  (state.items.length>12?'<p class="staff-help">Mostrate le prime 12 righe.</p>':'')+'</div>':'';
 const check=state.remote?'<div class="import-result" aria-live="polite"><b>Anteprima verificata da Supabase</b>'+
  '<div><span>'+state.remote.new+' nuovi</span><span>'+state.remote.existing+' già presenti</span><span>'+state.remote.duplicates+' duplicati ignorati</span></div></div>':'';
 return '<section class="glass panel staff-editor import-panel"><div class="staff-panel-heading"><div><span class="eyebrow">IMPORTAZIONE SICURA</span><h2>Calendario CSV</h2></div></div>'+
 '<p class="staff-help">Importa il calendario di una competizione esistente. Nessun risultato già registrato verrà sostituito. Prima viene simulata la transazione su Supabase; poi potrai confermare.</p>'+
 '<div class="staff-form-grid"><label class="staff-field"><span>Competizione / stagione corrente</span><select data-import-competition>'+options+'</select></label>'+
 '<label class="staff-field"><span>File CSV (fino a 250 righe)</span><input type="file" data-import-file accept=".csv,text/csv,text/plain"></label></div>'+
 '<details class="import-template"><summary>Formato CSV supportato</summary><p>Separatore ; (oppure virgola), colonne <code>giornata;data;ora;casa;ospite;campo;indirizzo</code>. La data è GG/MM/AAAA, con ora HH:mm nel fuso Europe/Rome. Accettato anche <code>kickoff_at</code> ISO 8601 con fuso.</p><p>Non importare risultati o marcatori: i file vengono trattati esclusivamente come calendario di partite programmate.</p></details>'+
 errors+preview+check+'<div class="import-actions">'+button('preview','Verifica su Supabase',!state.items.length||!!state.errors.length||state.busy)+
 button('commit','Conferma importazione',!state.remote||!state.remote.new||state.busy)+'</div></section>';
}
export function installCalendarImport(getContext){
 if(installed)return;installed=true;provider=getContext;
 document.addEventListener('change',async e=>{
  const el=e.target;
  if(el.matches('[data-import-competition]')){state.competition=el.value;state.remote=null;provider().render();return}
  if(!el.matches('[data-import-file]'))return;
  const file=el.files?.[0];state.items=[];state.errors=[];state.remote=null;state.file=file?.name||'';
  if(!file){provider().render();return}
  if(file.size>1024*1024){state.errors=[{line:0,message:'Dimensione massima 1 MB'}];provider().render();return}
  try{const parsed=parseFixtureCSV(await file.text());state.items=parsed.rows;state.errors=parsed.errors;
   if(!state.items.length&&!state.errors.length)state.errors.push({line:0,message:'Non sono presenti righe valide'})}
  catch(ex){state.errors=[{line:0,message:ex.message}]}
  provider().render();
 });
 document.addEventListener('click',async e=>{
  const btn=e.target.closest('[data-import-action]');if(!btn)return;
  const action=btn.dataset.importAction;if(state.busy)return;
  const ctx=provider();
  if(!['admin','manager'].includes(ctx.state.identity?.role?.role))return;
  if(!state.items.length||state.errors.length||!state.competition){ctx.toast('CSV non valido');return}
  if(action==='commit'&&(!state.remote||state.remote.new===0)){ctx.toast('Esegui prima l’anteprima');return}
  if(action==='commit'&&!window.confirm('Inserire '+state.remote.new+' nuove fixture? Nessun incontro esistente sarà modificato.'))return;
  state.busy=true;btn.disabled=true;
  try{
   const result=await rpc('tm_app_import_fixtures',{p_competition_id:state.competition,p_rows:state.items,p_dry_run:action!=='commit'});
   if(!result?.ok)throw Error('Importazione non confermata');
   if(action==='preview'){state.remote=result;ctx.render();ctx.toast('Anteprima verificata')}
   else{state.remote=null;state.items=[];state.errors=[];state.file='';await ctx.reloadAll();ctx.toast(result.new+' nuovi incontri inseriti')}
  }catch(err){state.remote=null;ctx.toast('Importazione: '+err.message);ctx.render()}
  finally{state.busy=false}
 });
}
