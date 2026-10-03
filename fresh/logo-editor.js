/** Shared badge editor: local crop, palette extraction and accessible reordering.
 * Source images remain local until the enclosing form is submitted.
 */
const E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slots=['primary_color','secondary_color','accent_color'];
const defaults=['#336a97','#f5f5f5','#d0b44d'];
const validHex=s=>/^#[\da-f]{6}$/i.test(s||'');
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
const rgbToHex=rgb=>'#'+rgb.map(n=>clamp(Math.round(n),0,255).toString(16).padStart(2,'0')).join('');
export function extractLogoColors(imageData){
 const {data}=imageData;
 const bins=new Map();
 const pixelStride=Math.max(1,Math.ceil((data.length/4)/20000));
 for(let i=0;i<data.length;i+=4*pixelStride){ // Adaptive stride avoids dropping colors from small logos.
  const alpha=data[i+3];
  if(alpha<100)continue;
  const r=data[i],g=data[i+1],b=data[i+2];
  const key=[r>>4,g>>4,b>>4].join(':');
  const prev=bins.get(key)||{count:0,r:0,g:0,b:0};
  prev.count++;prev.r+=r;prev.g+=g;prev.b+=b;bins.set(key,prev);
 }
 const candidates=[...bins.values()].map(x=>({count:x.count,rgb:[x.r/x.count,x.g/x.count,x.b/x.count]}))
  .sort((a,b)=>b.count-a.count);
 const chosen=[];
 // Spatial distance avoids three swatches that are shades of the same hue.
 for(const candidate of candidates){
  if(chosen.length>=3)break;
  const far=chosen.every(p=>Math.hypot(...candidate.rgb.map((n,i)=>n-p.rgb[i]))>=68);
  if(far)chosen.push(candidate);
 }
 for(const candidate of candidates){
  if(chosen.length>=3)break;
  if(!chosen.includes(candidate))chosen.push(candidate);
 }
 const unique=chosen.map(x=>rgbToHex(x.rgb));
 for(const fallback of defaults){if(unique.length>=3)break;if(!unique.includes(fallback))unique.push(fallback)}
 return unique.slice(0,3);
}
export function logoPicker(url='',colors=[],shape='rounded',chooseShape=false){
 const selected=['circle','rounded','square'].includes(shape)?shape:'rounded';
 const palette=slots.map((slot,i)=>{
  const color=validHex(colors[i])?colors[i]:defaults[i];
  return '<label class="logo-palette-slot" draggable="true" data-color-slot="'+i+'" title="Trascina per cambiare ordine">'+
   '<span class="logo-palette-grip" aria-hidden="true">⠿</span>'+
   '<span class="logo-palette-title">Colore '+(i+1)+'</span>'+
   '<input type="color" name="'+slot+'" value="'+color+'" aria-label="Colore '+(i+1)+'">'+
   '<span class="logo-palette-value">'+E(color.toUpperCase())+'</span>'+
   '<span class="logo-palette-actions"><button type="button" data-logo-shift="-1" data-color-index="'+i+'" aria-label="Sposta colore '+(i+1)+' a sinistra">‹</button>'+
   '<button type="button" data-logo-shift="1" data-color-index="'+i+'" aria-label="Sposta colore '+(i+1)+' a destra">›</button></span></label>';
 }).join('');
 const shapeSelect=chooseShape?
  '<label class="staff-field logo-shape-field"><span>Forma comune di tutti gli stemmi</span>'+
   '<select name="logo_shape" data-logo-shape-select>'+
   [['rounded','Quadrato arrotondato'],['circle','Cerchio'],['square','Quadrato']].map(([v,n])=>'<option value="'+v+'"'+(selected===v?' selected':'')+'>'+n+'</option>').join('')+
   '</select></label>':
   '<small class="staff-help">Forma comune della squadra: '+E(selected==='circle'?'cerchio':selected==='square'?'quadrato':'quadrato arrotondato')+'</small>';
 return '<div class="staff-logo-picker" data-logo-picker data-shape="'+selected+'" tabindex="0" aria-label="Editor logo, incolla un’immagine o seleziona un file">'+
  '<div class="logo-picker-controls">'+
   '<label class="staff-soft logo-upload">Seleziona file<input type="file" data-logo-file accept="image/png,image/jpeg,image/webp" hidden></label>'+ (url?'<button type="button" class="staff-soft logo-edit-existing" data-logo-edit-existing>Ritaglia logo attuale</button>':'')+
   '<span class="staff-help">Oppure incolla qui con Ctrl+V / Cmd+V. PNG, JPG o WebP, massimo 8 MB.</span></div>'+
  '<div class="logo-editor-main"><div class="logo-frame" data-logo-frame data-shape="'+selected+'">'+
   (url?'<img src="'+E(url)+'" alt="Stemma attuale" data-logo-existing>':'<span class="logo-placeholder" data-logo-placeholder>Anteprima</span>')+
   '<canvas width="256" height="256" data-logo-canvas aria-label="Trascina l’immagine per regolare il ritaglio" hidden></canvas></div>'+
   '<div class="logo-editor-tools"><label>Zoom <input type="range" data-logo-zoom min="0.5" max="3" step="0.05" value="1" disabled></label>'+
    '<button type="button" data-logo-reset disabled>Centra immagine</button>'+
    '<button type="button" data-logo-extract disabled>Rileva colori</button>'+
    '<p class="staff-help">Sposta l’immagine nel riquadro per scegliere il ritaglio. Il file salvato manterrà questo ritaglio.</p>'+
    shapeSelect+'</div></div>'+
   '<div class="logo-colors"><div class="logo-colors-heading"><strong>Palette estratta dal logo</strong><small>Trascina i colori per riordinarli, oppure modificali a mano.</small></div>'+
    '<div class="logo-palette" data-logo-palette>'+palette+'</div></div></div>';
}
function editorState(picker){
 const form=picker.closest('form');
 if(!form)return null;
 form._logoEditor??={image:null,scale:1,dx:0,dy:0,manualColors:false,pointer:null};
 return form._logoEditor;
}
function updatePalette(picker,values,markManual=false){
 const state=editorState(picker);if(!state)return;
 const fields=slots.map(x=>picker.querySelector('input[name="'+x+'"]'));
 values.forEach((v,i)=>{if(!fields[i]||!validHex(v))return;fields[i].value=v;const display=fields[i].closest('.logo-palette-slot')?.querySelector('.logo-palette-value');if(display)display.textContent=v.toUpperCase()});
 if(markManual)state.manualColors=true;
}
function currentColors(picker){return slots.map(x=>picker.querySelector('input[name="'+x+'"]')?.value||defaults[slots.indexOf(x)])}
function drawCrop(picker,extract=false){
 const state=editorState(picker);if(!state?.image)return;
 const canvas=picker.querySelector('[data-logo-canvas]'),ctx=canvas.getContext('2d',{willReadFrequently:true});
 const image=state.image,size=canvas.width;
 const ratio=Math.max(size/image.width,size/image.height)*state.scale;
 const w=image.width*ratio,h=image.height*ratio;
 state.dx=clamp(state.dx,-size,size);state.dy=clamp(state.dy,-size,size);
 ctx.clearRect(0,0,size,size);ctx.imageSmoothingQuality='high';
 ctx.drawImage(image,(size-w)/2+state.dx,(size-h)/2+state.dy,w,h);
 if(extract&&!state.manualColors)updatePalette(picker,extractLogoColors(ctx.getImageData(0,0,size,size)));
}
async function acceptImage(picker,file){
 if(!file)return;
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8*1024*1024)throw Error('Usa PNG, JPG o WebP, fino a 8 MB.');
 const bitmap=await createImageBitmap(file);
 const state=editorState(picker);if(!state){bitmap.close?.();throw Error('Editor non disponibile')}
 state.image?.close?.();state.image=bitmap;state.scale=1;state.dx=0;state.dy=0;state.manualColors=false;
 const canvas=picker.querySelector('[data-logo-canvas]');
 canvas.hidden=false;picker.querySelector('[data-logo-existing]')?.setAttribute('hidden','');
 picker.querySelector('[data-logo-placeholder]')?.setAttribute('hidden','');
 for(const el of picker.querySelectorAll('[data-logo-zoom],[data-logo-reset],[data-logo-extract]'))el.disabled=false;
 picker.querySelector('[data-logo-zoom]').value='1';
 drawCrop(picker,true);
}
function reorder(picker,from,to){
 if(!Number.isInteger(from)||!Number.isInteger(to)||from===to||from<0||to<0||from>2||to>2)return;
 const values=currentColors(picker),[moved]=values.splice(from,1);values.splice(to,0,moved);
 updatePalette(picker,values,true);
}
export async function prepareLogoForUpload(form){
 if(form._logoEditorLoading)await form._logoEditorLoading;
 const picker=form.querySelector('[data-logo-picker]'),state=picker?editorState(picker):null;
 if(!state?.image)return null;
 drawCrop(picker,false);
 const canvas=picker.querySelector('[data-logo-canvas]');
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Ritaglio del logo non riuscito')),'image/png'));
}
function queueLogoImage(picker,file){
 const promise=acceptImage(picker,file);
 const form=picker.closest('form');
 if(form)form._logoEditorLoading=promise;
 promise.catch(e=>window.alert(e.message));
 return promise;
}
/** Delegated DOM event handler; use on document change,input,paste,pointer*,drag* and click. */
export function handleLogoEditorEvent(event){
 const target=event.target;
 const picker=target.closest?.('[data-logo-picker]');
 if(!picker)return false;
 const state=editorState(picker);
 try{
  if(event.type==='change'&&target.matches('[data-logo-file]')){
   queueLogoImage(picker,target.files?.[0]);
   return true;
  }
  if(event.type==='paste'){
   const item=[...(event.clipboardData?.items||[])].find(x=>x.type.startsWith('image/'));
   if(item){event.preventDefault();queueLogoImage(picker,item.getAsFile());return true}
  }
  if(event.type==='input'&&target.matches('[data-logo-zoom]')){
   state.scale=Number(target.value)||1;drawCrop(picker,true);return true;
  }
  if(event.type==='input'&&target.matches('input[type="color"]')){
   state.manualColors=true;picker.querySelector('.logo-palette-value');updatePalette(picker,currentColors(picker),true);return true;
  }
  if(event.type==='change'&&target.matches('[data-logo-shape-select]')){
   picker.dataset.shape=target.value;picker.querySelector('[data-logo-frame]').dataset.shape=target.value;return true;
  }
  if(event.type==='click'){
   if(target.closest('[data-logo-edit-existing]')){
    const image=picker.querySelector('[data-logo-existing]'),url=image?.src;
    if(url){
     const task=fetch(url,{mode:'cors'}).then(response=>{
      if(!response.ok)throw Error('Logo esistente non accessibile: seleziona nuovamente il file.');
      return response.blob();
     }).then(blob=>acceptImage(picker,new File([blob],'logo.png',{type:blob.type||'image/png'})));
     picker.closest('form')._logoEditorLoading=task;
     task.catch(e=>window.alert(e.message));
    }
    return true;
   }
   const shift=target.closest('[data-logo-shift]');
   if(shift){reorder(picker,Number(shift.dataset.colorIndex),Number(shift.dataset.logoShift)+Number(shift.dataset.colorIndex));return true}
   if(target.closest('[data-logo-reset]')){
    state.dx=0;state.dy=0;state.scale=1;picker.querySelector('[data-logo-zoom]').value=1;drawCrop(picker,true);return true;
   }
   if(target.closest('[data-logo-extract]')){state.manualColors=false;drawCrop(picker,true);return true}
  }
  if(event.type==='pointerdown'&&target.matches('[data-logo-canvas]')&&state.image){
   event.preventDefault();state.pointer={id:event.pointerId,x:event.clientX,y:event.clientY};
   target.setPointerCapture(event.pointerId);return true;
  }
  if(event.type==='pointermove'&&target.matches('[data-logo-canvas]')&&state.pointer?.id===event.pointerId){
   const bounds=target.getBoundingClientRect(),factor=target.width/bounds.width;
   state.dx+=(event.clientX-state.pointer.x)*factor;state.dy+=(event.clientY-state.pointer.y)*factor;
   state.pointer.x=event.clientX;state.pointer.y=event.clientY;drawCrop(picker,false);return true;
  }
  if(['pointerup','pointercancel'].includes(event.type)&&state.pointer?.id===event.pointerId){
   state.pointer=null;drawCrop(picker,true);return true;
  }
  if(event.type==='dragstart'){
   const slot=target.closest('[data-color-slot]');if(slot){
    event.dataTransfer?.setData('text/plain',String(slot.dataset.colorSlot));
    if(event.dataTransfer)event.dataTransfer.effectAllowed='move';return true;
   }
  }
  if(event.type==='dragover'){
   if(target.closest('[data-color-slot]')||(event.dataTransfer?.types||[]).includes('Files')){event.preventDefault();return true}
  }
  if(event.type==='drop'){
   const slot=target.closest('[data-color-slot]');
   if(slot&&(event.dataTransfer?.types||[]).includes('text/plain')&&!event.dataTransfer?.files?.length){
    event.preventDefault();reorder(picker,Number(event.dataTransfer.getData('text/plain')),Number(slot.dataset.colorSlot));return true;
   }
   const file=[...(event.dataTransfer?.files||[])].find(f=>f.type.startsWith('image/'));
   if(file){event.preventDefault();queueLogoImage(picker,file);return true}
  }
 }catch(e){window.alert(e.message);return true}
 return false;
}
