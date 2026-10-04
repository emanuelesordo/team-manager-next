/** Editor tattico accessibile: tap-to-place mobile, drag-and-drop desktop. */
const START='starter';
/** Moduli ammessi per lo schieramento (10 giocatori di movimento). */
export const formationModules=Object.freeze(["4-4-2","4-3-3","4-5-1","3-4-3","3-5-2","3-1-5-1","5-3-2","5-4-1","4-2-2-2","4-2-3-1","2-4-4","2-5-3"]);
const basePositions=formation=>{
 const numbers=String(formation||'').split(/[-–]/).map(Number);
 const lines=numbers.length>=2&&numbers.length<=5&&numbers.every(n=>Number.isInteger(n)&&n>0&&n<=6)&&numbers.reduce((a,b)=>a+b,0)===10?numbers:[4,4,2];
 const out=[{slot:1,x:50,y:91}];let slot=2;
 lines.forEach((count,i)=>{const y=75-(i/(lines.length-1||1))*58;for(let p=0;p<count;p++)out.push({slot:slot++,x:100*(p+1)/(count+1),y})});
 return out;
};
export const pitchPositions=formation=>basePositions(formation);
export function pitchMarkup(){
 return '<div class="visual-lineup">'+
 '<div class="visual-field" data-lineup-pitch><span class="field-circle"></span><span class="field-midline"></span>'+
 Array.from({length:11},(_,i)=>'<button type="button" class="field-slot" data-pitch-slot="'+(i+1)+'" aria-label="Posizione '+(i+1)+'"><strong>'+(i+1)+'</strong></button>').join('')+
 '</div><span class="pitch-selection" data-pitch-selection aria-live="polite" hidden></span></div>';
}
export function paintCallups(){
 const form=document.querySelector('form[data-staff-form="callups"]');if(!form)return;
 const rows=[...form.querySelectorAll('[data-callup-player]')];
 for(const row of rows){
  const out=row.querySelector('[name=selection]').value==='absent';
  row.dataset.out=String(out);
  const choice=row.querySelector('[name=reason]');
  if(out&&!choice.value)choice.value='technical_choice';
  for(const button of row.querySelectorAll('[data-callup-reason]')){
   const active=out&&choice.value===button.dataset.callupReason;
   button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active));
  }
  form.querySelector('[data-callup-list="'+(out?'absent':'available')+'"]').appendChild(row);
 }
 for(const status of ['available','absent'])form.querySelector('[data-callup-count="'+status+'"]').textContent=String(rows.filter(row=>(row.dataset.out==='true')===(status==='absent')).length);
}
let activePlayer=null,attached=false,sortKey='name',sortDesc=false;
export function numericSortValue(value){const n=Number(String(value??'').trim().replace(',','.'));return Number.isFinite(n)?n:0}
function sortLineup(form){const list=form?.querySelector('.lineup-rows');if(!list)return;const rows=[...list.querySelectorAll('[data-lineup-player]')];rows.sort((a,b)=>{const x=a.dataset['sort'+sortKey[0].toUpperCase()+sortKey.slice(1)],y=b.dataset['sort'+sortKey[0].toUpperCase()+sortKey.slice(1)];const missing=n=>n==null||String(n).trim()===''||String(n).trim()==='0'||String(n).trim()==='—';if(sortKey==='number'&&missing(x)!==missing(y))return missing(x)?1:-1;const v=['number','rating'].includes(sortKey)?numericSortValue(x)-numericSortValue(y):String(x||'').localeCompare(String(y||''),'it',{sensitivity:'base',numeric:true});return (sortDesc?-v:v)||String(a.dataset.sortName).localeCompare(String(b.dataset.sortName),'it')});rows.forEach(row=>list.appendChild(row));form.querySelectorAll('[data-lineup-sort]').forEach(b=>b.setAttribute('aria-sort',b.dataset.lineupSort===sortKey?(sortDesc?'descending':'ascending'):'none'))}
function markDuplicateNumbers(form){const rows=rowList(form),groups=new Map();for(const row of rows){const n=Number(row.querySelector('[name=shirt]')?.value);if(n>0){const members=groups.get(n)||[];members.push(row);groups.set(n,members)}}for(const row of rows){const n=Number(row.querySelector('[name=shirt]')?.value);const duplicate=n>0&&(groups.get(n)||[]).length>1;row.classList.toggle('duplicate-shirt',duplicate);const display=row.querySelector('[data-lineup-number]');if(display)display.textContent=n||'—';row.dataset.sortNumber=String(n||0)}}
function changeShirt(form,row){if(!row||form.dataset.lineupEnabled!=='true')return;const current=row.querySelector('[name=shirt]'),before=current.value;const entered=window.prompt('Numero maglia (1–99)',before);if(entered===null)return;const next=entered.trim();if(!/^[1-9][0-9]?$/.test(next))return;const counterpart=rowList(form).find(x=>x!==row&&Number(x.querySelector('[name=shirt]').value)===Number(next));if(counterpart)counterpart.querySelector('[name=shirt]').value=before;current.value=String(Number(next));markDuplicateNumbers(form);sortLineup(form);paintLineupPitch();changed(form)}
function changed(form){if(form?.dataset.lineupEnabled==='true')document.dispatchEvent(new CustomEvent('tm-lineup-change',{detail:{form}}))}
function currentForm(){return document.querySelector('form[data-staff-form="lineup"]')}
function rowList(form){return [...form.querySelectorAll('[data-lineup-player]')]}
function getStatus(row){return row.querySelector('[name="status"]')}
function getSlot(row){return row.querySelector('input[name="slot"]')}
function getName(row){return row.querySelector('.lineup-name strong')?.textContent?.trim()||'Giocatore'}
function slotOf(row){return Number(getSlot(row)?.value||0)}
function isStarter(row){return getStatus(row)?.value===START}
export function paintLineupPitch(){
 const form=currentForm(),field=form?.querySelector('[data-lineup-pitch]');if(!field)return;
 const rows=rowList(form),positions=basePositions(form.elements.formation?.value);
 markDuplicateNumbers(form);
 const selected=rows.find(r=>r.dataset.lineupPlayer===activePlayer);
 form.querySelector('[data-pitch-selection]').textContent=selected?'Selezionato: '+getName(selected):'';
 for(const pos of positions){
  const cell=field.querySelector('[data-pitch-slot="'+pos.slot+'"]');
  const row=rows.find(r=>isStarter(r)&&slotOf(r)===pos.slot);
  cell.style.left=pos.x+'%';cell.style.top=pos.y+'%';
  cell.classList.toggle('occupied',!!row);cell.classList.toggle('target',!!selected);cell.replaceChildren();
  const number=document.createElement('strong');number.textContent=row?(row.querySelector('[name=shirt]')?.value||'•'):'+'; if(row){number.dataset.pitchJersey=row.dataset.lineupPlayer;number.title='Clicca per cambiare maglia'}
  const caption=document.createElement('span');caption.textContent=row?getName(row):'';
  cell.append(number,caption);if(row&&form.dataset.lineupEnabled==='true'){const remove=document.createElement('span');remove.className='pitch-remove';remove.dataset.pitchRemove=row.dataset.lineupPlayer;remove.textContent='×';remove.title='Rimuovi dal campo';cell.append(remove)}cell.title=(row?getName(row):'Slot '+pos.slot)+' · posizione '+pos.slot;
  cell.disabled=form.dataset.lineupEnabled!=='true';
  cell.dataset.playerId=row?.dataset.lineupPlayer||'';
  cell.draggable=Boolean(row)&&form.dataset.lineupEnabled==='true';
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
 getStatus(target).value=START;getSlot(target).value=String(slot);activePlayer=null;paintLineupPitch();changed(form);
}
export function installLineupPitch(){
 if(attached)return;attached=true;
 document.addEventListener('click',e=>{
  const button=e.target.closest('[data-callup-reason]');
  const form=button?.closest('form[data-staff-form="callups"]');
  if(!form||button.disabled)return;
  const row=button.closest('[data-callup-player]');
  const selection=row.querySelector('[name=selection]');
  const reason=row.querySelector('[name=reason]');
  if(selection.value==='absent'&&reason.value===button.dataset.callupReason){
   selection.value='available';reason.value='';
  }else{
   selection.value='absent';reason.value=button.dataset.callupReason;
  }
  paintCallups();
  document.dispatchEvent(new CustomEvent('tm-callup-change',{detail:{
   matchId:form.dataset.callupMatch,playerId:row.dataset.callupPlayer,
   status:selection.value,reason:reason.value
  }}));
 });
 document.addEventListener('click',e=>{
  const form=e.target.closest('form[data-staff-form="lineup"]');if(!form)return;
  const order=e.target.closest('[data-lineup-sort]');if(order){const key=order.dataset.lineupSort;sortDesc=sortKey===key?!sortDesc:false;sortKey=key;sortLineup(form);return}
  const num=e.target.closest('[data-lineup-number]');if(num){changeShirt(form,num.closest('[data-lineup-player]'));return}
  const remove=e.target.closest('[data-pitch-remove]');if(remove){const row=rowList(form).find(r=>r.dataset.lineupPlayer===remove.dataset.pitchRemove);if(row){getStatus(row).value='bench';getSlot(row).value='';activePlayer=null;paintLineupPitch();changed(form)}return}
  const jersey=e.target.closest('[data-pitch-jersey]');if(jersey){
   const occupied=rowList(form).find(r=>r.dataset.lineupPlayer===jersey.dataset.pitchJersey);
   if(!occupied)return;
   changeShirt(form,occupied);return;
  }
  const target=e.target.closest('[data-pitch-slot]');if(target){
   if(!activePlayer){if(target.dataset.playerId){activePlayer=target.dataset.playerId;paintLineupPitch()}return}
   assign(Number(target.dataset.pitchSlot),activePlayer);return;
  }
  const name=e.target.closest('.lineup-name');
  if(name){const row=name.closest('[data-lineup-player]');activePlayer=activePlayer===row?.dataset.lineupPlayer?null:row?.dataset.lineupPlayer||null;paintLineupPitch()}
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
  paintLineupPitch();changed(form);
 });
 document.addEventListener('dragstart',e=>{
  const cell=e.target.closest('[data-lineup-pitch] .field-slot');
  const name=e.target.closest('.lineup-name');const row=cell&&cell.dataset.playerId?rowList(currentForm()).find(r=>r.dataset.lineupPlayer===cell.dataset.playerId):name?.closest('[data-lineup-player]');
  if(row&&row.querySelector('[name=status]')&&!getStatus(row).disabled){
    e.dataTransfer?.setData('text/plain',row.dataset.lineupPlayer);activePlayer=row.dataset.lineupPlayer}
 });
 document.addEventListener('dragover',e=>{if(e.target.closest('[data-lineup-pitch] .field-slot'))e.preventDefault()});
 document.addEventListener('drop',e=>{
  const cell=e.target.closest('[data-lineup-pitch] .field-slot');if(!cell)return;
  e.preventDefault();const id=e.dataTransfer?.getData('text/plain');if(id)assign(Number(cell.dataset.pitchSlot),id);
 });
}
