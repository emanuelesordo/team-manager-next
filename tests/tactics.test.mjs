import test from 'node:test';import assert from 'node:assert/strict';
const{tacticalHistory,staffTacticsPanel,tacticalPayload}=await import('../fresh/tactics.js');
test('history escapes notes and names',()=>{
 const html=tacticalHistory([{minute:34,formation_from:'4-4-2',formation_to:'4-3-3',positions:[{slot:1,player_id:'a'}],notes:'<svg onload=alert(1)>'}],[{id:'a',first_name:'Mario',last_name:'Rossi'}]);
 assert.match(html,/34/);assert.doesNotMatch(html,/<svg/);assert.match(html,/Rossi/);
});
test('editor only live',()=>{
 const ctx={state:{data:{players:[]},matchData:{players:[],tacticalChanges:[]}}};
 assert.match(staffTacticsPanel(ctx,{status:'live',formation:'4-4-2'}),/data-staff-form="tactics"/);
 assert.doesNotMatch(staffTacticsPanel(ctx,{status:'finished',formation:'4-4-2'}),/data-staff-form="tactics"/);
});
test('payload validates duplicate IDs',()=>{
 const form={elements:{minute:{value:'25'},formation_to:{value:'4-4-2'},notes:{value:'Ok'}},querySelectorAll:()=>[
  {value:'id1',dataset:{tacticSlot:'1'}},{value:'id2',dataset:{tacticSlot:'2'}}]};
 assert.equal(tacticalPayload(form).positions.length,2);
 const invalid={...form,querySelectorAll:()=>[{value:'id1',dataset:{tacticSlot:'1'}},{value:'id1',dataset:{tacticSlot:'2'}}]};
 assert.throws(()=>tacticalPayload(invalid),/più posizioni/);
});
