import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {POSITION_SPOTS,groupForPosition,playerRoleProfile,renderPlayerRoleHeatmap,renderRoleAffinityEditor,collectRoleAffinityForm} from '../fresh/player-role-heatmap.js';

const catalog=[
 {id:'r1',code:'TD',label:'Terzino destro',category:'defender',sort_order:30,active:true},
 {id:'r2',code:'QD',label:'Quinto destro',category:'midfielder',sort_order:42,active:true},
 {id:'r3',code:'AD',label:'Ala destra',category:'forward',sort_order:70,active:true}
];
const affinities=[
 {player_id:'one',position_id:'r2',affinity_pct:75,is_natural:false},
 {player_id:'one',position_id:'r1',affinity_pct:100,is_natural:true},
 {player_id:'two',position_id:'r3',affinity_pct:40,is_natural:true}
];
const makeForm=values=>({elements:{namedItem(name){return {value:values[name]??''}}}});
test('heatmap shows precisely configured roles and labels, with no inferred data',()=>{
 const html=renderPlayerRoleHeatmap('one',affinities,catalog);
 assert.match(html,/Terzino destro/);
 assert.match(html,/Quinto destro/);
 assert.match(html,/100%/);
 assert.match(html,/75%/);
 assert.match(html,/psi-role-spot/);
 assert.doesNotMatch(html,/Ala destra/);
 assert.match(renderPlayerRoleHeatmap('missing',affinities,catalog),/non ancora configurati/);
});
test('player role profile sorts natural first even when secondary categories differ',()=>{
 const profile=playerRoleProfile('one',affinities,catalog);
 assert.equal(profile.natural.code,'TD');
 assert.deepEqual(profile.roles.map(x=>x.code),['TD','QD']);
 assert.equal(groupForPosition('goalkeeper'),'P');
 assert.equal(groupForPosition('defender'),'D');
 assert.equal(groupForPosition('midfielder'),'C');
 assert.equal(groupForPosition('forward'),'A');
 assert.equal(groupForPosition('fictional'),null);
 for(const p of catalog)assert.ok(POSITION_SPOTS[p.code]);
});
test('editor stores only manually entered affinities, natural always at 100',()=>{
 const rows=collectRoleAffinityForm(makeForm({natural_position:'TD',affinity__TD:'20',affinity__QD:'81'}),catalog);
 assert.deepEqual(rows,[{code:'TD',affinity:100,natural:true},{code:'QD',affinity:81,natural:false}]);
 assert.equal(collectRoleAffinityForm(makeForm({}),catalog),null);
 assert.throws(()=>collectRoleAffinityForm(makeForm({natural_position:'none'}),catalog),/valido/);
 assert.throws(()=>collectRoleAffinityForm(makeForm({affinity__QD:'78'}),catalog),/naturale/);
 assert.throws(()=>collectRoleAffinityForm(makeForm({natural_position:'TD',affinity__AD:'105'}),catalog),/1 a 100/);
 assert.throws(()=>collectRoleAffinityForm(makeForm({natural_position:'TD',affinity__AD:'5.5'}),catalog),/1 a 100/);
});
test('staff editor includes a single natural position and per-position numeric inputs',()=>{
 const html=renderRoleAffinityEditor('one',affinities,catalog);
 assert.match(html,/name="natural_position"/);
 assert.match(html,/name="affinity__QD"/);
 assert.match(html,/value="75"/);
 assert.match(html,/data-role-editor/);
 assert.doesNotMatch(html,/data-lineup/);
});
test('data flow wires role editor to staff save and a new carousel without touching lineup badges',()=>{
 const staff=readFileSync(new URL('../fresh/staff-ui.js',import.meta.url),'utf8');
 const player=readFileSync(new URL('../fresh/player-intelligence.js',import.meta.url),'utf8');
 const api=readFileSync(new URL('../fresh/api.js',import.meta.url),'utf8');
 const main=readFileSync(new URL('../fresh/main.js',import.meta.url),'utf8');
 assert.match(staff,/renderRoleAffinityEditor\(/);
 assert.match(staff,/collectRoleAffinityForm\(/);
 assert.match(staff,/tm_app_save_player_roles/);
 assert.match(player,/renderPlayerRoleHeatmap\(/);
 assert.match(player,/\['Ruoli',\[roles\]\]/);
 assert.match(main,/rolePositions:state\.data\?\.rolePositions/);
 assert.match(api,/app_player_role_affinities/);
 assert.match(api,/football_positions/);
 assert.doesNotMatch(readFileSync(new URL('../fresh/lineup-pitch.js',import.meta.url),'utf8'),/roleAffinity|affinityPct|affinity_pct/);
});
