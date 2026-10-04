import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {kitModels,kitModelPresets,modelKit,kitStyles,normalizeKit,shirtSvg,collectionForClub,newKitKey} from '../fresh/kit-editor.js';
const main=readFileSync(new URL('../fresh/main.js',import.meta.url),'utf8');
const staff=readFileSync(new URL('../fresh/staff-ui.js',import.meta.url),'utf8');
const pitch=readFileSync(new URL('../fresh/lineup-pitch.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../fresh/staff.css',import.meta.url),'utf8');

test('i 20 modelli del bozzetto e i 4 da foto hanno un preset e SVG isolato',()=>{
 assert.equal(kitModels.length>=24,true);
 assert.equal(Object.keys(kitModelPresets).length,24);
 assert.equal(new Set(kitStyles).size,kitStyles.length);
 for(let i=0;i<kitModels.length;i++){
  const kit=modelKit(kitModels[i].id);
  const svg=shirtSvg(kit,'mock-'+i);
  assert.match(svg,/<svg/);assert.match(svg,/<clipPath/);
  assert.match(svg,/<\/svg>/);
  assert.doesNotMatch(svg,/undefined|<script|onerror=|sponsor|nike/i);
 }
});
test('prima creazione solo un kit; preserva kit aggiuntivi e nomi persistenti',()=>{
 const fresh=collectionForClub({primary_color:'#111111',secondary_color:'#dddddd'});
 assert.deepEqual(Object.keys(fresh),['home']);
 assert.equal(fresh.home.primary,'#111111');
 const saved={home:{...fresh.home,name:'Casa 2026'},kit_2:{...fresh.home,name:'Speciale'},kit_3:{...fresh.home,name:'Portiere'}};
 const normalized=collectionForClub({kits:saved});
 assert.equal(normalized.kit_2.name,'Speciale');
 assert.equal(normalized.kit_3.name,'Portiere');
 assert.equal(newKitKey(normalized),'kit_4');
 assert.equal(normalizeKit({style:'nonsense'}).style,'stripes');
});
test('le immagini kit entrano nella scheda info e nei campi overview/formazione',()=>{
 assert.match(main,/data-match-kit-choice/);
 assert.match(main,/overviewLineup\(m,data,[^\n]+comp,activeKit\)/);
 assert.match(main,/tm_app_match_details/);
 assert.match(staff,/data-lineup-kit/);
 assert.match(pitch,/field-kit-shirt/);
 assert.match(css,/\.match-kit-grid/);
 assert.match(css,/\.kit-model-grid/);
});
