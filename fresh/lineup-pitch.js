/** Editor tattico accessibile: tap-to-place mobile, drag-and-drop desktop. */
const START='starter';
const basePositions=formation=>{
 const numbers=String(formation||'').split(/[-–]/).map(Number);
 const lines=numbers.length>=2&&numbers.length<=5&&numbers.every(n=>Number.isInteger(n)&&n>0&&n<=6)&&numbers.reduce((a,b)=>a+b,0)===10?numbers:[4,4,2];
 const out=[{slot:1,x:50,y:91}];let slot=2;
 lines.forEach((count,i)=>{const y=75-(i/(lines.length-1||1))*58;for(let p=0;p<count;p++)out.push({slot:slot++,x:100*(p+1)/(count+1),y})});
 return out;
};
export const pitchPositions=formation=>basePositions(formation);
export function pitchMarkup(){
 return '<div class="visual-lineup"><div class="visual-lineup-head"><strong>Campo tattico · schieramento</strong><small>Seleziona un giocatore e tocca la posizione; da computer puoi trascinare il nome.</small></div>'+
 '<div class="visual-field" data-lineup-pitch><span class="field-circle"></span><span class="field-midline"></span>'+
 Array.from({length:11},(_,i)=>'<button type="button" class="field-slot" data-pitch-slot="'+(i+1)+'" aria-label="Posizione '+(i+1)+'"><strong>'+(i+1)+'</strong></button>').join('')+
 '</div><p class="pitch-selection" data-pitch-selection aria-live="polite">Tocca il nome di un giocatore per posizionarlo.</p></div>';
}
let activePlayer=null,attached=false;
function currentForm(){return document.querySelector('form[data-staff-form="lineup"]')}
function rowList(form){return [...form.querySelectorAll('[data-lineup-player]')]}
function getStatus(row){return row.querySelector('select[name="status"]')}
function getSlot(row){return row.querySelector('input[name="slot"]')}
function getName(row){return row.querySelector('.lineup-name strong')?.textContent?.trim()||'Giocatore'}
function slotOf(row){return Number(getSlot(row)?.value||0)}
function isStarter(row){return getStatus(row)?.value===START}
export function paintLineupPitch(){
 const form=currentForm(),field=form?.querySelector('[data-lineup-pitch]');if(!field)return;
 const rows=rowList(form),positions=basePositions(form.elements.formation?.value);
 const selected=rows.find(r=>r.dataset.lineupPlayer===activePlayer);
 form.querySelector('[data-pitch-selection]').textContent=selected?'Da posizionare: '+getName(selected):'Tocca il nome di un giocatore per posizionarlo.';
 for(const pos of positions){
  const cell=field.querySelector('[data-pitch-slot="'+pos.slot+'"]');
  const row=rows.find(r=>isStarter(r)&&slotOf(r)===pos.slot);
  cell.style.left=pos.x+'%';cell.style.top=pos.y+'%';
  cell.classList.toggle('occupied',!!row);cell.classList.toggle('target',!!selected);cell.replaceChildren();
  const number=document.createElement('strong');number.textContent=row?(row.querySelector('[name=shirt]')?.value||'•'):String(pos.slot);
  const caption=document.createElement('span');caption.textContent=row?getName(row):'Libero';
  cell.append(number,caption);cell.title=(row?getName(row):'Slot '+pos.slot)+' · posizione '+pos.slot;
  cell.disabled=Boolean(form.querySelector('input[name=formation]')?.disabled);
 }
 for(const row of rows)row.classList.toggle('pitch-armed',row.dataset.lineupPlayer===activePlayer);
}
function assign(slot,playerId){
 const form=currentForm();if(!form)return;
 const rows=rowList(form),target=rows.find(r=>r.dataset.lineupPlayer===playerId);
 if(!target||getStatus(target).disabled)return;
 const previous=slotOf(target),old=rows.find(r=>r!==target&&isStarter(r)&&slotOf(r)===slot);
 if(old){if(previous&&isStarter(target)&&previous!==slot)getSlot(old).value=String(previous);
  else{getStatus(old).value='bench';getSlot(old).value='';const radio=old.querySelector('input[name=captain]');if(radio?.checked)radio.checked=false}}
 getStatus(target).value=START;getSlot(target).value=String(slot);activePlayer=playerId;paintLineupPitch();
}
export function installLineupPitch(){
 if(attached)return;attached=true;
 document.addEventListener('click',e=>{
  const form=e.target.closest('form[data-staff-form="lineup"]');if(!form)return;
  const target=e.target.closest('[data-pitch-slot]');if(target){
   if(!activePlayer){form.querySelector('[data-pitch-selection]').textContent='Prima seleziona il nome di un giocatore.';return}
   assign(Number(target.dataset.pitchSlot),activePlayer);return;
  }
  const name=e.target.closest('.lineup-name');
  if(name){const row=name.closest('[data-lineup-player]');activePlayer=row?.dataset.lineupPlayer||null;paintLineupPitch()}
 });
 document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('form[data-staff-form="lineup"] .lineup-name')){e.preventDefault();activePlayer=e.target.closest('[data-lineup-player]')?.dataset.lineupPlayer||null;paintLineupPitch()}});
 document.addEventListener('change',e=>{
  const el=e.target,form=el.closest('form[data-staff-form="lineup"]');if(!form)return;
  const row=el.closest('[data-lineup-player]');
  if(row&&el.matches('select[name="status"]')){
   const reason=row.querySelector('select[name="reason"]');
   if(reason){reason.disabled=el.disabled||el.value!=='absent';if(el.value==='absent'&&!reason.value)reason.value='technical_choice'}
  }
  if(row&&el.matches('select[name="status"]')&&el.value!=='starter'){getSlot(row).value='';const captain=row.querySelector('[name=captain]');if(captain?.checked)captain.checked=false}
  if(row&&el.matches('select[name="status"]')&&el.value==='starter'&&!slotOf(row)){
   const occupied=new Set(rowList(form).filter(r=>isStarter(r)).map(slotOf));
   const free=Array.from({length:11},(_,i)=>i+1).find(n=>!occupied.has(n));if(free)getSlot(row).value=String(free);
  }
  paintLineupPitch();
 });
 document.addEventListener('dragstart',e=>{
  const name=e.target.closest('.lineup-name');const row=name?.closest('[data-lineup-player]');
  if(row&&row.querySelector('select[name=status]')&&!getStatus(row).disabled){
    e.dataTransfer?.setData('text/plain',row.dataset.lineupPlayer);activePlayer=row.dataset.lineupPlayer}
 });
 document.addEventListener('dragover',e=>{if(e.target.closest('[data-lineup-pitch] .field-slot'))e.preventDefault()});
 document.addEventListener('drop',e=>{
  const cell=e.target.closest('[data-lineup-pitch] .field-slot');if(!cell)return;
  e.preventDefault();const id=e.dataTransfer?.getData('text/plain');if(id)assign(Number(cell.dataset.pitchSlot),id);
 });
}
