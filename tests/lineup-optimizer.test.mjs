import test from 'node:test';
import assert from 'node:assert/strict';
import {optimizeLineupAssignments} from '../fresh/lineup-optimizer.js';

test('global simulation beats greedy winger-first assignment',()=>{
 const players=[{id:'Grisolia'},{id:'Zanetti'},{id:'Fornale'}];
 const slots=[{id:'wing'},{id:'striker'}];
 const values={Grisolia:{wing:9,striker:10},Zanetti:{wing:8,striker:3},Fornale:{wing:2,striker:7}};
 const result=optimizeLineupAssignments(players,slots,(p,s)=>values[p.id][s.id]);
 assert.deepEqual(result.assignments.map(x=>[x.slot.id,x.player.id]),[['wing','Zanetti'],['striker','Grisolia']]);
 assert.equal(result.score,18);
});
test('a player cannot fill two slots and incomplete lineups are supported',()=>{
 const result=optimizeLineupAssignments([{id:1},{id:2}],[{id:'a'},{id:'b'},{id:'c'}],(p,s)=>p.id+(s.id==='c'?3:0));
 assert.equal(result.assignments.length,2);
 assert.equal(new Set(result.assignments.map(a=>a.player.id)).size,2);
 assert.equal(new Set(result.assignments.map(a=>a.slot.id)).size,2);
});
test('whole XI search finds optimum across 11 slots without factorial enumeration',()=>{
 const slots=Array.from({length:11},(_,id)=>({id}));
 const players=Array.from({length:23},(_,id)=>({id}));
 const result=optimizeLineupAssignments(players,slots,(p,s)=>p.id===s.id?10:0);
 assert.equal(result.assignments.length,11);
 assert.equal(result.assignments.reduce((sum,x)=>sum+x.weight,0),110);
 assert.ok(result.explored<1000000);
});
test('pair chemistry can break an additive tie without repeating players',()=>{
 const players=[{id:'A'},{id:'B'},{id:'C'}],slots=[{id:0},{id:1}];
 const r=optimizeLineupAssignments(players,slots,()=>5,{pairScore:(a,b)=>[a.id,b.id].sort().join('')==='BC'?1:0});
 assert.deepEqual(r.assignments.map(a=>a.player.id).sort(),['B','C']);
});
