/* Independent club shirt configurator, persisted by club UUID in teams / app_opponents.
   Preview is SVG and re-renders only its own nodes as colors change. */
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export const kitStyles=['solid','stripes','hoops','halves','diagonal'];
const swatches={home:{primary:'#18252b',secondary:'#ffdf22',number:'#ffffff',sleeves:'#18252b',style:'stripes'},
 away:{primary:'#eeeeee',secondary:'#1f3a45',number:'#111111',sleeves:'#eeeeee',style:'solid'},
 goalkeeper:{primary:'#4cae6a',secondary:'#1c4539',number:'#ffffff',sleeves:'#4cae6a',style:'solid'}};
export const isKitColor=x=>typeof x==='string'&&/^#[a-f0-9]{6}$/i.test(x);
export function normalizeKit(value={},fallback='home'){
 const base=swatches[fallback]||swatches.home,v=value&&typeof value==='object'?value:{};
 return {style:kitStyles.includes(v.style)?v.style:base.style,
  primary:isKitColor(v.primary)?v.primary:base.primary,
  secondary:isKitColor(v.secondary)?v.secondary:base.secondary,
  sleeves:isKitColor(v.sleeves)?v.sleeves:base.sleeves,
  number:isKitColor(v.number)?v.number:base.number};
}
export function defaultKits(club={}){
 const initial=club.kits&&typeof club.kits==='object'?club.kits:{};
 const heritage=club.kit_primary_color&&isKitColor(club.kit_primary_color)?{
  style:club.kit_style,primary:club.kit_primary_color,
  secondary:club.kit_secondary_color,number:club.kit_number_color,
  sleeves:club.kit_primary_color
 }:{
  primary:club.primary_color,secondary:club.secondary_color,
  sleeves:club.primary_color
 };
 return {
  home:normalizeKit(initial.home||heritage,'home'),
  away:normalizeKit(initial.away,'away'),
  goalkeeper:normalizeKit(initial.goalkeeper,'goalkeeper')
 };
}
export function shirtSvg(config={},uid='shirt',back=false){
 const kit=normalizeKit(config);
 const primary=kit.primary,secondary=kit.secondary,number=kit.number,sleeves=kit.sleeves;
 const clip='jersey-'+String(uid).replace(/[^a-z0-9_-]/gi,'');
 const shape='M40 17 L57 9 L68 16 Q73 24 78 24 Q84 24 89 16 L102 9 L121 17 L143 51 L124 65 L111 46 L111 148 L32 148 L32 46 L20 65 L1 51 Z';
 let fill='';
 if(kit.style==='stripes')fill=Array.from({length:8},(_,i)=>'<path d="M'+(22+i*14)+' 0h7v160h-7z" fill="'+secondary+'"/>').join('');
 if(kit.style==='hoops')fill=Array.from({length:5},(_,i)=>'<rect x="0" y="'+(24+i*29)+'" width="145" height="12" fill="'+secondary+'"/>').join('');
 if(kit.style==='halves')fill='<rect x="73" y="0" width="80" height="160" fill="'+secondary+'"/>';
 if(kit.style==='diagonal')fill='<path d="M-16 96L106 -8L159 44L37 148Z" fill="'+secondary+'"/>';
 return '<svg class="kit-svg" viewBox="0 0 145 160" role="img" aria-label="Maglia '+
   (back?'retro':'fronte')+'" xmlns="http://www.w3.org/2000/svg">'+
  '<defs><clipPath id="'+clip+'"><path d="'+shape+'"/></clipPath></defs>'+
  '<path d="'+shape+'" fill="'+primary+'" stroke="rgba(255,255,255,.28)" stroke-width="2"/>'+
  '<g clip-path="url(#'+clip+')">'+fill+
  '<path d="M1 51L40 17L41 56L20 65Z M102 9L121 17L143 51L124 65L105 48Z" fill="'+sleeves+'"/>'+
  '</g>'+
  '<path d="M57 9Q73 36 89 9L85 17Q73 30 61 17Z" fill="'+secondary+'"/>'+
  (back?'<text x="73" y="103" text-anchor="middle" fill="'+number+
   '" font-size="47" font-family="sans-serif" font-weight="900" stroke="rgba(0,0,0,.12)" stroke-width=".5">10</text>':
   '<path d="M72 56V67M67 61H77" stroke="'+number+'" stroke-width="1.7" opacity=".75"/>')+
  '</svg>';
}
export function openKitConfigurator(club,onSave){
 if(!club?.id)throw Error('Salva prima la squadra per configurare le maglie.');
 if(typeof onSave!=='function')throw Error('Salvataggio non disponibile.');
 const prior=document.querySelector('.kit-editor-overlay');if(prior)prior.remove();
 const presets=defaultKits(club),draft=JSON.parse(JSON.stringify(presets));
 let selected='home',pending=false;
 const node=document.createElement('div');
 node.className='overlay kit-editor-overlay';
 node.innerHTML='<section class="overlay-card kit-editor-card" role="dialog" aria-modal="true" aria-labelledby="kit-editor-title">'+
  '<div class="kit-editor-header"><div><span class="eyebrow">DIVISE SQUADRA</span><h2 id="kit-editor-title">'+esc(club.name)+'</h2></div>'+
  '<button class="icon-btn" type="button" data-kit-close aria-label="Chiudi">×</button></div>'+
  '<div class="kit-editor-tabs" role="tablist" aria-label="Tipo di maglia">'+
  [['home','Casa'],['away','Trasferta'],['goalkeeper','Portiere']].map(([id,name])=>
   '<button type="button" data-kit-tab="'+id+'" role="tab" aria-selected="'+(id==='home')+'">'+name+'</button>').join('')+'</div>'+
  '<div class="kit-editor-body"><div class="kit-editor-preview"><div data-kit-front></div><div data-kit-back></div>'+
  '<small>Anteprima grafica · fronte e retro</small></div>'+
  '<div class="kit-editor-controls">'+
  '<label>Disegno<select data-kit-field="style">'+[
   ['solid','Tinta unita'],['stripes','Strisce verticali'],['hoops','Fasce orizzontali'],['halves','Due metà'],['diagonal','Banda diagonale']
  ].map(([id,text])=>'<option value="'+id+'">'+text+'</option>').join('')+'</select></label>'+
  [['primary','Colore principale'],['secondary','Colore secondario'],['sleeves','Maniche'],['number','Numero']].map(([field,label])=>
   '<label>'+label+'<span class="kit-editor-color"><input type="color" data-kit-field="'+field+'"><output data-kit-hex="'+field+'"></output></span></label>').join('')+
  '</div></div><div class="kit-editor-footer"><p class="staff-help">Le tre divise sono collegate all’ID della squadra e restano disponibili in tutte le stagioni.</p>'+
  '<button type="button" class="staff-soft" data-kit-close>Annulla</button>'+
  '<button type="button" class="staff-submit" data-kit-save>Salva divise</button></div>'+
  '<p class="kit-editor-error" role="alert" data-kit-error hidden></p></section>';
 const close=()=>{node.remove();document.removeEventListener('keydown',escapeHandler);};
 const escapeHandler=e=>{if(e.key==='Escape'){e.preventDefault();close();}};
 const paint=()=>{
  for(const button of node.querySelectorAll('[data-kit-tab]'))button.setAttribute('aria-selected',String(button.dataset.kitTab===selected));
  for(const input of node.querySelectorAll('[data-kit-field]')){
   input.value=draft[selected][input.dataset.kitField];
   const output=node.querySelector('[data-kit-hex="'+input.dataset.kitField+'"]');
   if(output)output.textContent=input.value.toUpperCase();
  }
  node.querySelector('[data-kit-front]').innerHTML=shirtSvg(draft[selected],'front',false);
  node.querySelector('[data-kit-back]').innerHTML=shirtSvg(draft[selected],'back',true);
 };
 node.addEventListener('click',async event=>{
  if(event.target===node||event.target.closest('[data-kit-close]')){if(!pending)close();return}
  const tab=event.target.closest('[data-kit-tab]');
  if(tab){selected=tab.dataset.kitTab;paint();return}
  const save=event.target.closest('[data-kit-save]');
  if(save&&!pending){
   pending=true;save.disabled=true;
   const error=node.querySelector('[data-kit-error]');error.hidden=true;
   try{await onSave(JSON.parse(JSON.stringify(draft)));close()}
   catch(err){error.textContent='Salvataggio non riuscito: '+(err?.message||err);error.hidden=false;save.disabled=false;pending=false}
  }
 });
 node.addEventListener('input',event=>{
  const input=event.target.closest('[data-kit-field]');
  if(!input)return;
  const key=input.dataset.kitField;
  if(key==='style'&&!kitStyles.includes(input.value))return;
  if(key!=='style'&&!isKitColor(input.value))return;
  draft[selected][key]=input.value;
  const output=node.querySelector('[data-kit-hex="'+key+'"]');if(output)output.textContent=input.value.toUpperCase();
  node.querySelector('[data-kit-front]').innerHTML=shirtSvg(draft[selected],'front',false);
  node.querySelector('[data-kit-back]').innerHTML=shirtSvg(draft[selected],'back',true);
 });
 document.body.appendChild(node);
 document.addEventListener('keydown',escapeHandler);
 node.querySelector('[data-kit-close]')?.focus();
 paint();
 return node;
}
