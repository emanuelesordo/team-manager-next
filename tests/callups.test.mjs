import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const staff=readFileSync(new URL('../fresh/staff-ui.js',import.meta.url),'utf8');
const pitch=readFileSync(new URL('../fresh/lineup-pitch.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../fresh/staff.css',import.meta.url),'utf8');
const main=readFileSync(new URL('../fresh/main.js',import.meta.url),'utf8');
test('callups and formation use separate tabs and save functions',()=>{
 assert.match(staff,/\['callups','Convocazioni'\],\['lineup','Formazione'\]/);
 assert.match(staff,/data-staff-form="callups"/);
 assert.match(staff,/rpc\('tm_app_save_callups'/);
 assert.match(staff,/rpc\('tm_app_save_formation'/);
 assert.match(staff,/lineup-minimal/);
 assert.match(staff,/data-lineup-enabled/);
});
test('callups have two moveable lists and five icon reasons',()=>{
 for(const value of ['illness','injury','suspension','personal','technical_choice'])assert.match(staff,new RegExp("'"+value+"'"));
 assert.doesNotMatch(staff,/data-callup-toggle/);
 assert.match(pitch,/selection.value==='absent'&&reason.value===button.dataset.callupReason/);
 assert.match(staff,/data-callup-reason/);
 assert.match(staff,/data-callup-list="available"/);
 assert.match(staff,/data-callup-list="absent"/);
 assert.match(pitch,/function paintCallups\(/);
 assert.match(pitch,/appendChild\(row\)/);
 assert.match(css,/\.callup-columns\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/\.callup-list\{min-width:0;min-height:110px;padding:0;border:0/);
 assert.match(css,/\.callup-reason.selected\{background:/);
 assert.match(main,/paintCallups\(\)/);
});
test('formation unlocks on confirmed callups before kickoff',()=>{
 assert.match(staff,/const confirmed=current\.some/);
 assert.match(staff,/const allowed=confirmed/);
 assert.match(staff,/Conferma prima le convocazioni/);
 assert.doesNotMatch(staff,/La formazione è modificabile dal calcio d’inizio/);
});

test('icon selections persist immediately and verify database records',()=>{
 assert.match(pitch,/new CustomEvent\('tm-callup-change'/);
 assert.match(main,/document\.addEventListener\('tm-callup-change'/);
 assert.match(staff,/export async function persistCallupChange/);
 assert.match(staff,/rpc\('tm_app_save_callups'/);
 assert.match(staff,/await get\('app_match_players'/);
 assert.match(staff,/Il database non conferma la convocazione/);
});

test('manual save verifies all selected rows on Supabase before success',()=>{
 assert.match(staff,/if\(!rows\.length\)throw Error/);
 assert.match(staff,/Number\(result\)!==rows\.length/);
 assert.match(staff,/const byId=new Map\(saved\.map/);
 assert.match(staff,/if\(differences\.length\)throw Error/);
 assert.match(staff,/Convocazioni salvate e verificate/);
});

test('callups use automatic writes only and restore last saved choice on failure',()=>{
 const segment=staff.slice(staff.indexOf('function matchCallups('),staff.indexOf('function matchLineup('));
 assert.doesNotMatch(segment,/submit\('Salva convocazioni'\)/);
 assert.match(segment,/Salvataggio automatico/);
 assert.match(segment,/data-persisted-status/);
 assert.match(main,/button.disabled=true/);
 assert.match(main,/current.dataset.persistedStatus/);
 assert.match(main,/paintCallups\(\)/);
});
