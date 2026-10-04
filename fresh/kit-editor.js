/* Modelli vettoriali delle divise: nessuna immagine remota, sponsor o logo.
   Le chiavi dei kit sono stabili, il nome e il modello sono modificabili. */
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export const kitModels=Object.freeze([
 ['solid','Tinta unita'],['center-panel','Pannello centrale'],['shoulder-band','Spalle a contrasto'],['sky-raglan','Raglan bicolore'],
 ['red-shoulders','Spalle scure'],['pinstripes','Righe sottili'],['claret-sleeves','Maniche a contrasto'],['red-classic','Classica'],
 ['cross-stripes','Strisce con fascia'],['contrast-collar','Colletto chiaro'],['trimmed','Bordi a contrasto'],['white-classic','Bianca classica'],
 ['yellow-classic','Colletto scuro'],['bold-stripes','Righe larghe'],['side-panels','Pannelli laterali'],['black-red','Rossonera'],
 ['red-white','Biancorossa'],['claret-trim','Raglan con bordi'],['low-sash','Banda bassa'],['dark-sash','Banda diagonale scura'],
 ['white-red-sash','Bianca fascia rossa'],['heather-raglan','Raglan mélange'],['royal-stripes','Blu a bande'],['yellow-dots','Puntinata gialla'],
 ['stripes','Verticali standard'],['hoops','Fasce orizzontali'],['halves','Due metà'],['diagonal','Diagonale standard']
].map(([id,label])=>({id,label})));
export const kitStyles=Object.freeze(kitModels.map(x=>x.id));
const defaults={home:{style:'stripes',primary:'#18252b',secondary:'#ffdf22',sleeves:'#18252b',number:'#ffffff'},
 away:{style:'solid',primary:'#eeeeee',secondary:'#1f3a45',sleeves:'#eeeeee',number:'#111111'},
 goalkeeper:{style:'solid',primary:'#4cae6a',secondary:'#1c4539',sleeves:'#4cae6a',number:'#ffffff'}};
const labels={home:'Prima maglia',away:'Trasferta',goalkeeper:'Portiere'};
const palette=['#ffffff','#eeeeee','#111111','#192d4d','#283a79','#2564c8','#83b3db','#a21524','#ec1425','#c01a27','#72243a','#ffd323','#ff961c','#53a86a','#111f1b','#8d8d8d'];

/* Colorazioni di riferimento dei 20 bozzetti e delle quattro fotografie. */
export const kitModelPresets=Object.freeze({
 'solid':['#213f75','#213f75','#213f75','#ffffff'],
 'center-panel':['#ae151d','#ffffff','#ffffff','#ffffff'],
 'shoulder-band':['#f4f5f5','#142032','#f4f5f5','#f5ca27'],
 'sky-raglan':['#8db8df','#25314d','#25314d','#ffffff'],
 'red-shoulders':['#bd1f24','#a51219','#bd1f24','#ffffff'],
 'pinstripes':['#ffffff','#db1221','#db1221','#ba161d'],
 'claret-sleeves':['#75283a','#83b6d8','#83b6d8','#ffffff'],
 'red-classic':['#b81925','#8d1523','#b81925','#ffffff'],
 'cross-stripes':['#ffffff','#d8202c','#ffffff','#ffffff'],
 'contrast-collar':['#292b66','#ffffff','#292b66','#ffffff'],
 'trimmed':['#2d58a4','#ecca35','#2d58a4','#ffffff'],
 'white-classic':['#ffffff','#e7e7e7','#ffffff','#17252c'],
 'yellow-classic':['#f7eb25','#111111','#f7eb25','#111111'],
 'bold-stripes':['#ffffff','#18244e','#ffffff','#18244e'],
 'side-panels':['#272a66','#b3222b','#b3222b','#ffffff'],
 'black-red':['#161619','#c51e2c','#c51e2c','#ffffff'],
 'red-white':['#ffffff','#bb2029','#bb2029','#f8cd1e'],
 'claret-trim':['#762a3a','#8bb5d5','#762a3a','#ffffff'],
 'low-sash':['#b31f2c','#ffffff','#b31f2c','#ffffff'],
 'dark-sash':['#ffa52b','#24231f','#ffa52b','#24231f'],
 'white-red-sash':['#ffffff','#e6212d','#ffffff','#e6212d'],
 'heather-raglan':['#ed1421','#ff9ea1','#ee5c65','#ffffff'],
 'royal-stripes':['#101c46','#1b4baf','#101c46','#ffffff'],
 'yellow-dots':['#131314','#f2d51c','#131314','#ffffff']
});
export function modelKit(id,base={}){
 const colors=kitModelPresets[id],current=normalizeKit(base);
 return colors?{...current,style:id,primary:colors[0],secondary:colors[1],sleeves:colors[2],number:colors[3]}:{...current,style:id};
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
const shape='M40 17 L57 9 L68 16 Q73 24 78 24 Q84 24 89 16 L102 9 L121 17 L143 51 L124 65 L111 46 L111 148 L32 148 L32 46 L20 65 L1 51 Z';
const torso='<path d="M40 17L57 9L68 16Q78 29 89 16L102 9L111 46V148H32V46Z"/>';
const bands=(color,n=8,width=8,from=28)=>Array.from({length:n},(_,i)=>'<path d="M'+(from+i*(width+6))+' 0h'+width+'v160h-'+width+'z" fill="'+color+'"/>').join('');
const hoops=(color,n=5)=>Array.from({length:n},(_,i)=>'<rect x="0" y="'+(20+i*30)+'" width="146" height="13" fill="'+color+'"/>').join('');
function pattern(kit){
 const p=kit.primary,s=kit.secondary,sl=kit.sleeves;
 const sleeves='<path d="M1 51L40 17L43 48L20 65ZM102 9L121 17L143 51L124 65L101 44Z" fill="'+sl+'"/>';
 const sash='<path d="M-4 122L113 -12L148 13L25 152Z" fill="'+s+'"/>';
 switch(kit.style){
  case 'stripes':return bands(s,8,7,21)+sleeves;
  case 'hoops':return hoops(s)+sleeves;
  case 'halves':return '<path d="M73 0H147V160H73Z" fill="'+s+'"/>'+sleeves;
  case 'diagonal':return sash+sleeves;
  case 'center-panel':return '<path d="M42 14H102L110 150H33Z" fill="'+p+'"/>'+sleeves;
  case 'shoulder-band':return '<path d="M0 0H146V34H0Z" fill="'+s+'"/>'+sleeves;
  case 'sky-raglan':case 'claret-sleeves':case 'red-classic':case 'white-classic':case 'yellow-classic':case 'contrast-collar':return sleeves;
  case 'red-shoulders':return '<path d="M0 0H146V36H0Z" fill="'+s+'"/>'+sleeves;
  case 'pinstripes':return bands(s,9,3,29)+sleeves;
  case 'cross-stripes':return bands(s,7,8,31)+'<rect y="52" width="146" height="16" fill="'+s+'"/>'+sleeves;
  case 'trimmed':return sleeves;
  case 'bold-stripes':case 'black-red':case 'red-white':return bands(s,6,13,29)+sleeves;
  case 'side-panels':return '<path d="M24 0H40V160H24ZM104 0H121V160H104Z" fill="'+s+'"/>'+sleeves;
  case 'claret-trim':return sleeves;
  case 'low-sash':return '<path d="M-12 112L10 88L125 151L108 162Z" fill="'+s+'"/>'+sleeves;
  case 'dark-sash':case 'white-red-sash':return sash+sleeves;
  case 'heather-raglan':{
   const threads=Array.from({length:45},(_,i)=>'<path d="M0 '+(i*4+2)+'L146 '+(i*4-9)+'" stroke="'+s+'" stroke-width=".85" opacity=".45"/>').join('');
   return sleeves+'<g opacity=".75">'+threads+'</g>'+torso.replace('<path','<path fill="'+p+'"');
  }
  case 'royal-stripes':return bands(s,4,12,38)+sleeves;
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
  default:return sleeves;
 }
}
export function shirtSvg(config={},uid='shirt',back=false,shownNumber=null){
 const k=normalizeKit(config),clip='kit-'+String(uid).replace(/[^a-z0-9_-]/gi,'');
 const n=shownNumber===null?(back?'10':''):String(shownNumber??'').slice(0,3);
 const isCount=/^[0-9]{1,3}$/.test(n);
 return '<svg class="kit-svg" viewBox="0 0 145 160" role="img" aria-label="Maglia '+(back?'retro':'fronte')+'" xmlns="http://www.w3.org/2000/svg">'+
  '<defs><clipPath id="'+clip+'"><path d="'+shape+'"/></clipPath></defs>'+
  '<path d="'+shape+'" fill="'+k.primary+'" stroke="rgba(20,30,42,.6)" stroke-width="1.25"/>'+
  '<g clip-path="url(#'+clip+')">'+pattern(k)+
  '<path d="M37 52Q31 88 34 136L41 122M108 52Q116 92 109 138" fill="none" stroke="#000" stroke-width="2" opacity=".07"/>'+
  '</g>'+
  '<path d="M57 9Q73 36 89 9L85 17Q73 30 61 17Z" fill="'+k.secondary+'" stroke="#000" stroke-width=".45" opacity=".95"/>'+
  '<path d="M1 51L20 65M124 65L143 51M32 146H111" fill="none" stroke="'+k.secondary+'" stroke-width="2.8" opacity=".8"/>'+
  (isCount?'<text x="72" y="102" text-anchor="middle" fill="'+k.number+'" font-size="'+(n.length===3?31:43)+'" font-family="Arial,sans-serif" font-weight="900" stroke="#111" stroke-width=".8" paint-order="stroke fill">'+n+'</text>':'')+
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
  holder.innerHTML=kitModels.map((model,i)=>
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
