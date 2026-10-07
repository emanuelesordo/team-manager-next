import {API_URL,PUBLISHABLE_KEY} from './config.js';

const SESSION_KEY='tm_next_session';
const REOPEN_KEY='tm_csi_reopen_fixture';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const currentFixture=()=>{const m=/^#match\/([0-9a-f-]+)$/i.exec(location.hash||'');return m&&UUID.test(m[1])?m[1]:null};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function ensureStyles(){
 if(document.getElementById('tm-csi-import-style'))return;
 const style=document.createElement('style');style.id='tm-csi-import-style';
 style.textContent=`
 .csi-import-box{display:grid;gap:10px;margin:12px 0 16px;padding:12px 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
 .csi-import-box[hidden]{display:none}.csi-import-box textarea{box-sizing:border-box;width:100%;min-height:150px;resize:vertical;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--ink);padding:10px 12px;font:500 11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace}
 .csi-import-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.csi-import-file{position:relative;overflow:hidden}.csi-import-file input{position:absolute;inset:0;opacity:0;cursor:pointer}.csi-import-status{margin:0;color:var(--muted);font-size:11px}.csi-import-status.is-error{color:#d45858}.csi-import-status.is-ok{color:#4ea86b}
 @media(max-width:650px){.csi-import-row>*{flex:1 1 auto}.csi-import-box textarea{min-height:190px}}
 `;
 document.head.append(style);
}

function enhance(){
 ensureStyles();
 document.querySelectorAll('[data-staff-action="csi-check"]').forEach(button=>{
  if(button.dataset.csiEnhanced==='1')return;
  button.dataset.csiEnhanced='1';
  button.removeAttribute('data-staff-action');
  button.setAttribute('data-csi-import-toggle','');
  button.textContent='Importa dati CSI';
  const section=button.closest('.staff-subpanel,.staff-root')||button.parentElement;
  if(!section||section.querySelector('[data-csi-import-box]'))return;
  const box=document.createElement('div');
  box.className='csi-import-box';box.hidden=true;box.dataset.csiImportBox='';
  box.innerHTML='<p class="staff-help">Carica il JSON generato da csi-scraper oppure incollalo qui. Team Manager non contatta direttamente il sito CSI: i dati entrano solo come revisione provvisoria.</p>'+ 
   '<textarea data-csi-json spellcheck="false" placeholder="{\n  &quot;code&quot;: &quot;C11BD12&quot;,\n  &quot;home&quot;: {...},\n  &quot;away&quot;: {...},\n  &quot;events&quot;: [...]\n}"></textarea>'+ 
   '<div class="csi-import-row"><label class="staff-soft csi-import-file">Carica .json<input data-csi-file type="file" accept="application/json,.json"></label><button type="button" class="staff-submit" data-csi-import-submit>Importa e confronta</button></div>'+ 
   '<p class="csi-import-status" data-csi-import-status>Il JSON viene validato contro codice gara e squadre prima del salvataggio.</p>';
  const heading=button.closest('.staff-panel-heading');
  (heading||section.firstElementChild)?.after(box);
 });
}

async function importPayload(box){
 const fixtureId=currentFixture();
 if(!fixtureId)throw Error('Partita non identificata');
 const textarea=box.querySelector('[data-csi-json]');
 const raw=textarea?.value?.trim();
 if(!raw)throw Error('Incolla o carica prima il JSON CSI');
 let payload;
 try{payload=JSON.parse(raw)}catch{throw Error('JSON non valido')}
 const session=(()=>{try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{return null}})();
 if(!session?.access_token)throw Error('Accedi nuovamente per importare i dati');
 const response=await fetch(API_URL+'/functions/v1/csi-match-import',{
  method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','Accept':'application/json','apikey':PUBLISHABLE_KEY,'Authorization':'Bearer '+session.access_token},
  body:JSON.stringify({fixture_id:fixtureId,payload})
 });
 const data=await response.json().catch(()=>null);
 if(!response.ok||!data?.ok)throw Error(data?.error||'Import CSI non riuscito');
 return {fixtureId,...data};
}

function status(box,text,type=''){
 const node=box?.querySelector('[data-csi-import-status]');if(!node)return;
 node.className='csi-import-status'+(type?' is-'+type:'');node.textContent=text;
}

document.addEventListener('click',async event=>{
 const toggle=event.target.closest('[data-csi-import-toggle]');
 if(toggle){event.preventDefault();event.stopImmediatePropagation();const section=toggle.closest('.staff-subpanel,.staff-root');const box=section?.querySelector('[data-csi-import-box]');if(box)box.hidden=!box.hidden;return}
 const submit=event.target.closest('[data-csi-import-submit]');
 if(!submit)return;
 event.preventDefault();event.stopImmediatePropagation();
 const box=submit.closest('[data-csi-import-box]');if(!box)return;
 submit.disabled=true;status(box,'Validazione e importazione in corso…');
 try{
  const result=await importPayload(box);
  status(box,result.changed?`Importati ${result.events||0} eventi CSI. Apertura confronto…`:'Questo JSON era già stato importato. Apertura confronto…','ok');
  sessionStorage.setItem(REOPEN_KEY,result.fixtureId);
  setTimeout(()=>location.reload(),350);
 }catch(error){status(box,error.message||String(error),'error');submit.disabled=false}
},true);

document.addEventListener('change',async event=>{
 const input=event.target.closest('[data-csi-file]');if(!input)return;
 const box=input.closest('[data-csi-import-box]'),file=input.files?.[0];if(!box||!file)return;
 if(file.size>2*1024*1024){status(box,'File troppo grande: massimo 2 MB.','error');input.value='';return}
 try{const txt=await file.text();JSON.parse(txt);box.querySelector('[data-csi-json]').value=txt;status(box,'File caricato. Premi “Importa e confronta”.','ok')}
 catch{status(box,'Il file selezionato non contiene JSON valido.','error')}
},true);

const observer=new MutationObserver(enhance);observer.observe(document.documentElement,{subtree:true,childList:true});enhance();

const reopen=sessionStorage.getItem(REOPEN_KEY);
if(reopen&&reopen===currentFixture()){
 let attempts=0;const timer=setInterval(()=>{
  enhance();const tab=document.querySelector('[data-tab="verification"]');
  if(tab){sessionStorage.removeItem(REOPEN_KEY);tab.click();clearInterval(timer)}
  else if(++attempts>40){sessionStorage.removeItem(REOPEN_KEY);clearInterval(timer)}
 },150);
}
