import test from 'node:test';
import assert from 'node:assert/strict';
import {goalDistance,legacyChangeReason,eventAdvancedMarkup,mergeEventAdvanced,setEventDetailsScreen} from '../fresh/event-details.js';
test('zone porta e distanze metriche',()=>{
 assert.deepEqual(goalDistance({x:34,y:3}),{meters:3,zone:'goal_area'});
 assert.deepEqual(goalDistance({x:34,y:11}),{meters:11,zone:'penalty_area'});
 assert.deepEqual(goalDistance({x:34,y:21}),{meters:21,zone:'16_25'});
 assert.deepEqual(goalDistance({x:34,y:30}),{meters:30,zone:'26_35'});
 assert.deepEqual(goalDistance({x:34,y:52}),{meters:52,zone:'over_35'});
 assert.equal(goalDistance({x:80,y:10}),null);
});
test('motivazioni e metadati non toccano chiavi punteggio',()=>{
 assert.equal(legacyChangeReason('physical_precaution'),'injury_prevention');
 assert.equal(legacyChangeReason('energy'),null);
 const p=mergeEventAdvanced({counted_in_score:true,period:'second_half'},{goal_details:{body_part:'head'},disciplinary_reason:null,substitution_motivation:null});
 assert.equal(p.counted_in_score,true);
 assert.deepEqual(p.goal_details,{body_part:'head'});
 assert.equal('disciplinary_reason' in p,false);
});
test('pannello gol e motiva solo il Caselle',()=>{
 const goal=eventAdvancedMarkup({payload:{goal_details:{body_part:'foot'}}},'goal','opponent');
 assert.match(goal,/data-event-pitch/);
 assert.match(goal,/data-event-advanced-open/);
 assert.match(goal,/data-event-advanced-back/);
 assert.match(goal,/data-event-advanced hidden/);
 assert.doesNotMatch(goal,/<details/);
 assert.match(goal,/Azione personale/);
 assert.match(goal,/name="goal_body_part"/);
 assert.match(goal,/option value="foot" selected/);
 const awayCard=eventAdvancedMarkup(null,'yellow_card','opponent');
 assert.match(awayCard,/data-event-advanced hidden/);
 const ours=eventAdvancedMarkup(null,'yellow_card','team');
 assert.match(ours,/data-event-group="discipline"/);
});

test('navigazione base e dettagli conserva i dati, cambia titolo e resetta scroll',()=>{
 const baseTitle={textContent:'Aggiungi evento',dataset:{}};
 const changes=[];
 const sheet={
  classList:{toggle:(name,enabled)=>changes.push([name,enabled])},
  querySelector:(sel)=>sel==='.live-sheet-head h3'?baseTitle:null,
  setAttribute:(key,value)=>changes.push([key,value])
 };
 const back={focus:()=>changes.push(['focus','back'])};
 const forward={focus:()=>changes.push(['focus','forward'])};
 const groups={
  goal:{hidden:true},discipline:{hidden:false},substitution:{hidden:false}
 };
 const launch={hidden:false};
 const wrapper={
  hidden:true,
  querySelector:sel=>sel==='[data-event-advanced-back]'?back:
   Object.entries(groups).find(([key])=>sel==='[data-event-group="'+key+'"]')?.[1]||null,
  querySelectorAll:()=>[]
 };
 const saved={minute:{value:'45'},event_type:{value:'goal'},team_side:{value:'opponent'},goal_body_part:{value:'head'}};
 const form={
  dataset:{},scrollTop:180,elements:{namedItem:key=>saved[key]||null},
  querySelector:sel=>sel==='[data-event-advanced]'?wrapper:sel==='[data-event-advanced-launch]'?launch:sel==='[data-event-advanced-open]'?forward:null,
  closest:sel=>sel==='.live-event-sheet'?sheet:null
 };
 wrapper.closest=()=>form;
 setEventDetailsScreen(form,true);
 assert.equal(form.dataset.eventMode,'advanced');
 assert.equal(wrapper.hidden,false);
 assert.equal(launch.hidden,true);
 assert.equal(form.scrollTop,0);
 assert.equal(baseTitle.textContent,'Dettagli avanzati');
 assert.deepEqual(changes[0],['event-sheet-advanced',true]);
 form.scrollTop=125;
 setEventDetailsScreen(form,false);
 assert.equal(wrapper.hidden,true);
 assert.equal(launch.hidden,false);
 assert.equal(baseTitle.textContent,'Aggiungi evento');
 assert.equal(form.elements.namedItem('minute').value,'45');
 assert.equal(form.elements.namedItem('goal_body_part').value,'head');
 assert.equal(form.scrollTop,0);
 assert.ok(changes.some(item=>item[0]==='focus'&&item[1]==='forward'));
});
