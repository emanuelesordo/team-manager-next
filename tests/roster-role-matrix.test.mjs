import test from 'node:test';
import assert from 'node:assert/strict';
import {roleRows,roleSelection,renderRosterRoles} from '../fresh/roster-role-matrix.js';

const state={season:'season1',data:{
 players:[{id:'p2',first_name:'Giulio',last_name:'Grisolia'},{id:'p1',first_name:'Andrea',last_name:'Boschetto'}],
 roster:[{season_id:'season1',player_id:'p1'},{season_id:'season1',player_id:'p2'}],
 rolePositions:[{id:'r1',code:'TD',label:'Terzino destro',active:true},{id:'r2',code:'DC',label:'Difensore centrale',active:true}],
 roleAffinities:[{player_id:'p1',position_id:'r1',affinity_pct:100,is_natural:true}]
}};
test('uses N. Cognome and surname order for compact roster',()=>{
 const rows=roleRows({state});
 assert.deepEqual(rows.map(r=>r.name),['A. Boschetto','G. Grisolia']);
 assert.equal(rows[0].roles[0].code,'TD');
 const markup=renderRosterRoles({state});
 assert.match(markup,/A\. Boschetto/);
 assert.doesNotMatch(markup,/Boschetto Andrea/);
 assert.match(markup,/data-role-toggle="DC"/);
});
test('selection defaults natural 100 then 80 and 70',()=>{
 let roles=roleSelection([],'TD');
 roles=roleSelection(roles,'DC');
 roles=roleSelection(roles,'CC');
 assert.deepEqual(roles.map(r=>r.affinity),[100,80,70]);
 assert.deepEqual(roles.map(r=>r.natural),[true,false,false]);
});
