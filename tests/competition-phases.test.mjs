import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const staff=readFileSync(new URL('../fresh/staff-ui.js',import.meta.url),'utf8');
const main=readFileSync(new URL('../fresh/main.js',import.meta.url),'utf8');
const api=readFileSync(new URL('../fresh/api.js',import.meta.url),'utf8');

test('editable league hierarchy has regular D/E and nested phases',()=>{
 for(const field of ["tier_level","group_code","postseason_mode","phase_name","phase_role","phase_format","phase_tier"])
  assert.ok(staff.includes("'"+field+"'"),'Missing '+field);
 assert.match(staff,/const parent=c;/);
 assert.match(staff,/const parentId=selected\.id;/);
 assert.match(staff,/parent\.parent_competition_id\?0\.01:0\.1/);
 assert.ok(staff.includes("suggestedRole==='final'?'knockout'"));
 assert.ok(staff.includes("suggestedRole==='final'?2"));
});
test('new league source qualification rules are explicit and independent',()=>{
 for(const field of ["phase_source_a","phase_source_b","phase_min_rank","phase_max_rank"])
  assert.ok(staff.includes("'"+field+"'"),'Missing '+field);
 assert.match(staff,/tm_app_save_subcompetition/);
 assert.match(staff,/tm_app_apply_phase_qualifiers/);
 assert.match(staff,/roundRobinDraft\(entries,data\.fixtures\|\|\[\],sources\)/);
 assert.match(staff,/senza risultati ereditati/);
 assert.match(api,/phaseSources:/);
 assert.match(api,/phaseEntries:/);
});
test('public display keeps phases separate and 0-point season start',()=>{
 assert.match(main,/function competitionLabel\(c\)/);
 assert.match(main,/parent_competition_id/);
 assert.match(main,/Fase autonoma · tutti partono da 0/);
 assert.match(main,/filter\(x=>x\.competition_id===comp\?\.id\)/);
});
