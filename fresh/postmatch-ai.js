import {postmatchAIReport} from './api.js';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const loaded=new Map(),busy=new Set();
export function postmatchAIContainer(fixtureId,finished,loggedIn){
 if(!finished)return '';
 return '<section class="inner-card match-postmatch-ai" data-postmatch-ai="'+escape(fixtureId)+'">'+
 '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap"><h3 style="margin:0">Resoconto post-partita</h3>'+
 '<label style="display:flex;align-items:center;gap:8px;cursor:pointer">AI <input type="checkbox" data-postmatch-ai-toggle aria-label="Mostra resoconto AI"></label></div>'+
 '<div data-postmatch-ai-body hidden style="margin-top:14px;white-space:pre-wrap;line-height:1.65">'+
 (loggedIn?'Attiva AI per leggere il resoconto.':'Accedi per visualizzare il resoconto AI.')+'</div></section>';
}
async function load(host,force=false){
 const id=host.dataset.postmatchAi,body=host.querySelector('[data-postmatch-ai-body]');
 if(!id||!body||busy.has(id))return;
 busy.add(id);body.textContent='Caricamento resoconto AI…';
 try{
  let data=force?null:loaded.get(id);
  if(!data)data=await postmatchAIReport(id,'read');
  if(!data?.report||data.stale||force){
   if(data?.report){body.textContent=data.report+'\n\nAggiornamento del resoconto in corso…'}
   const generated=await postmatchAIReport(id,'generate',force);
   data=generated;
  }
  loaded.set(id,data);
  if(host.isConnected&&host.querySelector('[data-postmatch-ai-toggle]')?.checked){
   body.textContent=data.report||'Resoconto non disponibile.';
   body.insertAdjacentHTML('beforeend','<div style="margin-top:14px"><button type="button" class="soft-btn" data-postmatch-ai-refresh>Rigenera resoconto</button></div>');
  }
 }catch(error){
  if(host.isConnected){
   body.innerHTML='<p>'+escape(error.message||'Errore AI')+'</p><button type="button" class="soft-btn" data-postmatch-ai-refresh>Riprova Gemini</button>';
  }
 }finally{busy.delete(id)}
}
export function installPostmatchAI(){
 document.addEventListener('change',event=>{
  const toggle=event.target.closest('[data-postmatch-ai-toggle]');if(!toggle)return;
  const host=toggle.closest('[data-postmatch-ai]'),body=host?.querySelector('[data-postmatch-ai-body]');
  if(!body)return;body.hidden=!toggle.checked;
  if(toggle.checked)void load(host);
 });
 document.addEventListener('click',event=>{
  const button=event.target.closest('[data-postmatch-ai-refresh]');if(!button)return;
  const host=button.closest('[data-postmatch-ai]');if(host)void load(host,true);
 });
}
