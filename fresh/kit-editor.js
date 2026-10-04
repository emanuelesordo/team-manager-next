/* Modelli vettoriali delle divise: nessuna immagine remota, sponsor o logo.
   Le chiavi dei kit sono stabili, il nome e il modello sono modificabili. */
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
/* Solo silhouette realmente diverse nella galleria; gli ID legacy restano leggibili
   per non alterare nessuna maglia già registrata, in particolare i 4 kit Caselle. */
export const kitModels=Object.freeze([
 ['solid','Tinta unita'],['center-panel','Pannello centrale'],['shoulder-band','Spalle a contrasto'],
 ['sky-raglan','Raglan bicolore'],['pinstripes','Righe sottili'],['stripes','Righe larghe'],
 ['hoops','Fasce orizzontali'],['halves','Due metà'],['diagonal','Banda diagonale'],
 ['white-red-sash','Fascia trasversale'],['side-panels','Pannelli laterali'],
 ['cross-stripes','Strisce con fascia'],['yellow-dots','Puntinata'],
 ['low-sash','Banda bassa'],['heather-raglan','Raglan mélange']
].map(([id,label])=>({id,label})));
export const legacyKitStyles=Object.freeze([
 'red-shoulders','claret-sleeves','red-classic','contrast-collar','trimmed',
 'white-classic','yellow-classic','bold-stripes','black-red','red-white',
 'claret-trim','dark-sash','royal-stripes'
]);
export const kitStyles=Object.freeze([...kitModels.map(x=>x.id),...legacyKitStyles]);
const defaults={home:{style:'stripes',primary:'#18252b',secondary:'#ffdf22',sleeves:'#18252b',number:'#ffffff'},
 away:{style:'solid',primary:'#eeeeee',secondary:'#1f3a45',sleeves:'#eeeeee',number:'#111111'},
 goalkeeper:{style:'solid',primary:'#4cae6a',secondary:'#1c4539',sleeves:'#4cae6a',number:'#ffffff'}};
const labels={home:'Prima maglia',away:'Trasferta',goalkeeper:'Portiere'};
const palette=['#ffffff','#eeeeee','#111111','#192d4d','#283a79','#2564c8','#83b3db','#a21524','#ec1425','#c01a27','#72243a','#ffd323','#ff961c','#53a86a','#111f1b','#8d8d8d'];

/* Il modello descrive SOLO la geometria: non sovrascrive mai la palette.
   È fondamentale perché i quattro kit Caselle conservino esattamente i colori salvati. */
export function modelKit(id,base={}){
 const kit=normalizeKit(base);
 return kitStyles.includes(id)?{...kit,style:id}:kit;
}
export const isKitColor=x=>typeof x==='string'&&/^#[0-9a-f]{6}$/i.test(x);
const safeKey=x=>/^[a-z0-9_-]{1,60}$/.test(x);
export function normalizeKit(value={},fallback='home'){
 const base=defaults[fallback]||defaults.home,v=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
 return {name:String(v.name||labels[fallback]||'Kit').trim().slice(0,48)||'Kit',
  style:kitStyles.includes(v.style)?v.style:base.style,
  primary:isKitColor(v.primary)?v.primary:base.primary,
  secondary:isKitColor(v.secondary)?v.secondary:base.secondary,
  sleeves:isKitColor(v.sleeves)?v.sleeves:base.sleeves,
  number:isKitColor(v.number)?v.number:base.number};
}
export function defaultKits(club={}){
 const original=club.kits&&typeof club.kits==='object'&&!Array.isArray(club.kits)?club.kits:{};
 const legacy=club.kit_primary_color&&isKitColor(club.kit_primary_color)?{
  style:club.kit_style,primary:club.kit_primary_color,secondary:club.kit_secondary_color,
  number:club.kit_number_color,sleeves:club.kit_primary_color
 }:{primary:club.primary_color,secondary:club.secondary_color,sleeves:club.primary_color};
 return {home:normalizeKit(original.home||legacy,'home'),away:normalizeKit(original.away,'away'),goalkeeper:normalizeKit(original.goalkeeper,'goalkeeper')};
}
/* Nuove squadre: esattamente un kit iniziale. Le vecchie divise salvate non si perdono. */
export function collectionForClub(club={}){
 const existing=club.kits&&typeof club.kits==='object'&&!Array.isArray(club.kits)?club.kits:{};
 const keys=Object.keys(existing).filter(k=>safeKey(k)&&existing[k]&&typeof existing[k]==='object'&&!Array.isArray(existing[k]));
 if(keys.length)return Object.fromEntries(keys.map(k=>[k,normalizeKit(existing[k],k)]));
 return {home:defaultKits(club).home};
}
export function newKitKey(collection){
 for(let n=2;n<100000;n++)if(!Object.hasOwn(collection,'kit_'+n))return 'kit_'+n;
 throw Error('Troppi kit creati');
}
const shape='M40 17 L57 9 L68 16 Q73 24 78 24 Q84 24 89 16 L102 9 L121 17 L143 51 L124 65 L111 46 L111 148 Q73 151 32 148 L32 46 L20 65 L1 51 Z';
const torso='<path d="M40 17L57 9L68 16Q78 29 89 16L102 9L111 46V148H32V46Z"/>';
const bands=(color,n=8,width=8,from=28)=>Array.from({length:n},(_,i)=>'<path d="M'+(from+i*(width+6))+' 0h'+width+'v160h-'+width+'z" fill="'+color+'"/>').join('');
const hoops=(color,n=5)=>Array.from({length:n},(_,i)=>'<rect x="0" y="'+(20+i*30)+'" width="146" height="13" fill="'+color+'"/>').join('');
function pattern(kit){
 const p=kit.primary,s=kit.secondary,sl=kit.sleeves;
 const sleeves='<path d="M1 51L40 17L43 48L20 65ZM102 9L121 17L143 51L124 65L101 44Z" fill="'+sl+'"/>';
 const sash='<path d="M-4 122L113 -12L148 13L25 152Z" fill="'+s+'"/>';
 switch(kit.style){
  case 'solid':return sleeves;
  case 'stripes':return bands(s,6,12,24)+sleeves;
  case 'hoops':return hoops(s)+sleeves;
  case 'halves':return '<path d="M73 0H147V160H73Z" fill="'+s+'"/>'+sleeves;
  case 'diagonal':return '<path d="M-19 4L8 -11L160 126L138 165Z" fill="'+s+'"/>'+sleeves;
  case 'white-red-sash':return sash+sleeves;
  case 'center-panel':return '<path d="M54 9H91L97 151H47Z" fill="'+s+'"/>'+sleeves;
  case 'shoulder-band':return '<path d="M0 -3H146V31H0Z" fill="'+s+'"/>'+sleeves;
  case 'sky-raglan':return sleeves+'<path d="M39 17L57 9L61 16L43 47Z M89 16L102 9L112 46L104 39Z" fill="'+s+'"/>';
  case 'pinstripes':return bands(s,11,2.7,25)+sleeves;
  case 'cross-stripes':return bands(s,6,9,27)+'<rect y="55" width="146" height="15" fill="'+s+'"/>'+sleeves;
  case 'side-panels':return '<path d="M23 0H43L43 155H23ZM104 0H122V155H104Z" fill="'+s+'"/>'+sleeves;
  case 'low-sash':return '<path d="M-12 112L10 88L125 151L108 162Z" fill="'+s+'"/>'+sleeves;
  case 'heather-raglan':{
   const threads=Array.from({length:34},(_,i)=>'<path d="M0 '+(i*5+2)+'L146 '+(i*5-10)+'" stroke="'+s+'" stroke-width=".75" opacity=".34"/>').join('');
   return sleeves+'<g>'+threads+'</g>'+torso.replace('<path','<path fill="'+p+'"');
  }
  case 'yellow-dots':{
   let dots='';
   for(let row=0;row<29;row++)for(let col=0;col<22;col++){
    const x=3+col*6.6+(row%2?3.3:0),y=7+row*4.7;
    const distance=Math.abs(x-72)/72,visibility=Math.max(0,Math.min(1,(distance-.23)*1.55+(35-y)/240));
    const radius=Math.max(0,visibility*2.65);
    if(radius>.24)dots+='<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="'+radius.toFixed(2)+'" fill="'+s+'"/>';
   }
   return sleeves+dots;
  }
  // I vecchi pattern restano renderizzabili, pur non essendo duplicati nel catalogo.
  case 'red-shoulders':return '<path d="M0 0H146V36H0Z" fill="'+s+'"/>'+sleeves;
  case 'claret-sleeves':case 'red-classic':case 'white-classic':case 'yellow-classic':
  case 'contrast-collar':case 'trimmed':case 'claret-trim':return sleeves;
  case 'bold-stripes':case 'black-red':case 'red-white':return bands(s,6,13,29)+sleeves;
  case 'dark-sash':return sash+sleeves;
  case 'royal-stripes':return bands(s,4,12,38)+sleeves;
  default:return sleeves;
 }
}
export function shirtSvg(config={},uid='shirt',back=false,shownNumber=null){
 const k=normalizeKit(config),clip='kit-'+String(uid).replace(/[^a-z0-9_-]/gi,'');
 const sheen=clip+'-sheen';
 const n=shownNumber===null?(back?'10':''):String(shownNumber??'').slice(0,3);
 const isCount=/^[0-9]{1,3}$/.test(n);
 return '<svg class="kit-svg" viewBox="0 0 145 160" role="img" aria-label="Maglia '+(back?'retro':'fronte')+'" xmlns="http://www.w3.org/2000/svg">'+
  '<defs><clipPath id="'+clip+'"><path d="'+shape+'"/></clipPath>'+
  '<linearGradient id="'+sheen+'" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#fff" stop-opacity=".10"/><stop offset="43%" stop-color="#fff" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".065"/></linearGradient></defs>'+
  '<path d="'+shape+'" fill="'+k.primary+'" stroke="rgba(20,30,42,.42)" stroke-width="1.1"/>'+
  '<g clip-path="url(#'+clip+')">'+pattern(k)+
  '<path d="'+shape+'" fill="url(#'+sheen+')"/>'+
  '<path d="M39 38Q32 54 35 72M106 38Q113 60 109 79M35 136Q53 132 68 145M104 137Q93 133 81 145" fill="none" stroke="#000" stroke-width="1.15" opacity=".075"/>'+
  '<path d="M38 37Q42 53 43 60M103 37Q100 52 99 61" fill="none" stroke="#fff" stroke-width="1.2" opacity=".10"/>'+
  '</g>'+
  '<path d="M57 9Q73 36 89 9L85 17Q73 30 61 17Z" fill="'+k.secondary+'" stroke="#000" stroke-width=".45" opacity=".94"/>'+
  '<path d="M1 51L20 65M124 65L143 51M32 146Q73 149 111 146" fill="none" stroke="'+k.secondary+'" stroke-width="1.9" opacity=".55"/>'+
  (isCount?'<text x="72" y="102" text-anchor="middle" fill="'+k.number+'" font-size="'+(n.length===3?31:43)+'" font-family="Arial,sans-serif" font-weight="900" stroke="#111" stroke-width=".7" paint-order="stroke fill">'+n+'</text>':'')+
  '</svg>';
}
export function openKitConfigurator(club,onSave){
 if(!club?.id)throw Error('Salva prima la squadra per configurare le maglie.');
 if(typeof onSave!=='function')throw Error('Salvataggio non disponibile.');
 document.querySelector('.kit-editor-overlay')?.remove();
 const draft=JSON.parse(JSON.stringify(collectionForClub(club)));
 let selected=Object.keys(draft)[0],pending=false,paletteField='';
 const node=document.createElement('div');node.className='overlay kit-editor-overlay';
 node.innerHTML='<section class="overlay-card kit-editor-card" role="dialog" aria-modal="true" aria-labelledby="kit-editor-title">'+
 '<header class="kit-editor-header"><div><span class="eyebrow">CONFIGURAZIONE DIVISE</span><h2 id="kit-editor-title">'+esc(club.name)+'</h2></div>'+
 '<button type="button" class="icon-btn" data-kit-close aria-label="Chiudi">×</button></header>'+
 '<div class="kit-editor-tabs" data-kit-tabs aria-label="Kit della squadra"></div>'+
 '<div class="kit-editor-body"><div class="kit-editor-preview">'+
 '<div data-kit-front></div><div data-kit-back></div><small>Anteprima · fronte e retro</small></div>'+
 '<div class="kit-editor-controls"><label class="kit-editor-name">Nome del kit<input data-kit-name maxlength="48" placeholder="Nome della divisa" autocomplete="off"></label>'+
 '<span class="kit-editor-caption">Modello · seleziona un disegno</span>'+
 '<div class="kit-model-grid" data-kit-models></div>'+
 '<span class="kit-editor-caption">Colori personalizzati</span>'+
 '<div class="kit-colors" data-kit-colors></div></div></div>'+
 '<footer class="kit-editor-footer"><p class="staff-help">Ogni kit è collegato alla squadra in tutte le stagioni. Puoi aggiungerne altri in qualsiasi momento.</p>'+
 '<button type="button" class="staff-soft" data-kit-close>Annulla</button><button type="button" class="staff-submit" data-kit-save>Salva kit</button></footer>'+
 '<p class="kit-editor-error" role="alert" data-kit-error hidden></p></section>';
 const close=()=>{node.remove();document.removeEventListener('keydown',escapeHandler);};
 const escapeHandler=e=>{if(e.key==='Escape'&&!pending){e.preventDefault();close();}};
 const refreshTabs=()=>{
  node.querySelector('[data-kit-tabs]').innerHTML=Object.entries(draft).map(([key,kit])=>
   '<button type="button" data-kit-tab="'+esc(key)+'" class="kit-tab" aria-pressed="'+(key===selected)+'">'+esc(kit.name)+'</button>').join('')+
   '<button type="button" class="kit-tab kit-tab-add" data-kit-add>+ Nuova maglia</button>'+
   '';
 };
 const refreshModel=()=>{
  const holder=node.querySelector('[data-kit-models]');
  const available=draft[selected].style&&!kitModels.some(m=>m.id===draft[selected].style)?
   [...kitModels,{id:draft[selected].style,label:'Modello storico · in uso'}]:kitModels;
  holder.innerHTML=available.map((model,i)=>
   '<button type="button" class="kit-model" data-kit-style="'+model.id+'" aria-label="'+esc(model.label)+'" aria-pressed="'+(draft[selected].style===model.id)+'">'+
    shirtSvg(modelKit(model.id,draft[selected]),'model-'+i,false)+'<span>'+esc(model.label)+'</span></button>').join('');
 };
 const refreshColors=()=>{
  const fields=[['primary','Base'],['secondary','Disegno'],['sleeves','Maniche'],['number','Numero']];
  node.querySelector('[data-kit-colors]').innerHTML=fields.map(([key,label])=>
   '<div class="kit-color-row"><label for="kit-color-'+key+'">'+label+'</label>'+
   '<button type="button" class="kit-color-chip" data-kit-palette="'+key+'" title="Tavolozza '+label+'" style="--kit-color:'+draft[selected][key]+'"></button>'+
   '<input type="text" id="kit-color-'+key+'" data-kit-color="'+key+'" value="'+draft[selected][key]+'" maxlength="7" spellcheck="false" aria-label="Codice HEX '+label+'"/>'+
   '</div>').join('')+
   (paletteField?'<div class="kit-color-palette" role="group" aria-label="Colori disponibili">'+palette.map(color=>
    '<button type="button" data-kit-swatch="'+color+'" style="--kit-color:'+color+'" title="'+color+'" aria-label="Colore '+color+'"></button>').join('')+'</div>':'');
 };
 const paint=()=>{
  refreshTabs();
  node.querySelector('[data-kit-name]').value=draft[selected].name;
  node.querySelector('[data-kit-front]').innerHTML=shirtSvg(draft[selected],'front-'+selected,false);
  node.querySelector('[data-kit-back]').innerHTML=shirtSvg(draft[selected],'back-'+selected,true);
  refreshModel();refreshColors();
 };
 const updatePreview=()=>{node.querySelector('[data-kit-front]').innerHTML=shirtSvg(draft[selected],'front-'+selected,false);
  node.querySelector('[data-kit-back]').innerHTML=shirtSvg(draft[selected],'back-'+selected,true);refreshModel();};
 node.addEventListener('click',async event=>{
  if(event.target===node||event.target.closest('[data-kit-close]')){if(!pending)close();return;}
  const tab=event.target.closest('[data-kit-tab]');
  if(tab){selected=tab.dataset.kitTab;paletteField='';paint();return;}
  if(event.target.closest('[data-kit-add]')){const key=newKitKey(draft);draft[key]={...normalizeKit(draft[selected]),name:'Nuova maglia '+(Object.keys(draft).length+1)};selected=key;paint();node.querySelector('[data-kit-name]').focus();return;}
  // I kit referenziati da partite storiche non vengono cancellati dal configuratore.
  const patternButton=event.target.closest('[data-kit-style]');
  if(patternButton){draft[selected]=modelKit(patternButton.dataset.kitStyle,draft[selected]);updatePreview();refreshColors();return;}
  const choose=event.target.closest('[data-kit-palette]');
  if(choose){paletteField=paletteField===choose.dataset.kitPalette?'':choose.dataset.kitPalette;refreshColors();return;}
  const swatch=event.target.closest('[data-kit-swatch]');
  if(swatch&&paletteField){draft[selected][paletteField]=swatch.dataset.kitSwatch;paletteField='';refreshColors();updatePreview();return;}
  const save=event.target.closest('[data-kit-save]');
  if(save&&!pending){
   const nameInput=node.querySelector('[data-kit-name]');
   draft[selected].name=nameInput.value.trim().slice(0,48);
   const error=node.querySelector('[data-kit-error]');error.hidden=true;
   if(Object.values(draft).some(k=>!k.name||!kitStyles.includes(k.style)||['primary','secondary','sleeves','number'].some(f=>!isKitColor(k[f])))){
    error.textContent='Inserisci un nome e colori HEX validi per ogni maglia.';error.hidden=false;return;
   }
   pending=true;save.disabled=true;
   try{await onSave(JSON.parse(JSON.stringify(draft)));close();}
   catch(err){error.textContent='Salvataggio non riuscito: '+(err?.message||err);error.hidden=false;save.disabled=false;pending=false;}
  }
 });
 node.addEventListener('input',event=>{
  if(event.target.matches('[data-kit-name]')){draft[selected].name=event.target.value.slice(0,48);refreshTabs();return;}
  const key=event.target.dataset.kitColor;if(!key)return;
  let color=event.target.value.trim();
  if(/^([0-9a-f]{6})$/i.test(color))color='#'+color;
  if(!isKitColor(color))return;
  draft[selected][key]=color;updatePreview();
  const chip=node.querySelector('[data-kit-palette="'+key+'"]');if(chip)chip.style.setProperty('--kit-color',color);
 });
 document.body.append(node);document.addEventListener('keydown',escapeHandler);paint();
 node.querySelector('[data-kit-name]')?.focus();
 return node;
}
