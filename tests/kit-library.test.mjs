import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {kitModels,kitStyles,legacyKitStyles,modelKit,normalizeKit,shirtSvg,collectionForClub,newKitKey} from '../fresh/kit-editor.js';
const main=readFileSync(new URL('../fresh/main.js',import.meta.url),'utf8');
const staff=readFileSync(new URL('../fresh/staff-ui.js',import.meta.url),'utf8');
const pitch=readFileSync(new URL('../fresh/lineup-pitch.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../fresh/staff.css',import.meta.url),'utf8');
const names=['yellow-dots','center-panel','white-red-sash','heather-raglan'];

test('catalogo senza duplicati, tutti i 4 modelli Caselle selezionabili',()=>{
 assert.equal(kitModels.length,15);
 assert.equal(new Set(kitModels.map(x=>x.id)).size,kitModels.length);
 for(const id of names)assert.ok(kitModels.find(x=>x.id===id),'Manca il modello Caselle '+id);
 for(const id of legacyKitStyles)assert.ok(kitStyles.includes(id),'Pattern storico non supportato: '+id);
 const colors={name:'Paletta',primary:'#fab123',secondary:'#4321fa',sleeves:'#19ac38',number:'#eeeeee'};
 const previews=kitModels.map((model,index)=>{
  const kit=modelKit(model.id,colors);
  for(const field of ['name','primary','secondary','sleeves','number'])assert.equal(kit[field],colors[field],model.id+' non deve alterare '+field);
  const svg=shirtSvg(kit,'unique',false);
  assert.match(svg,/<svg/);assert.match(svg,/<clipPath/);assert.match(svg,/<linearGradient/);
  assert.match(svg,/<\/svg>/);
  assert.doesNotMatch(svg,/undefined|<script|onerror=|sponsor|nike/i);
  return svg;
 });
 assert.equal(new Set(previews).size,15,'Ogni anteprima deve avere una geometria distinta');
});
test('Caselle: quattro kit salvati mantengono chiavi, nomi, disegni e palette',()=>{
 const saved={
  home:{name:'MM Termoidraulica',style:'yellow-dots',number:'#ffd323',primary:'#131314',sleeves:'#131314',secondary:'#f2d51c'},
  away:{name:'Luciferi',style:'center-panel',number:'#111111',primary:'#ffd323',sleeves:'#111111',secondary:'#111111'},
  kit_2:{name:'RiverPeru',style:'white-red-sash',number:'#111111',primary:'#ffffff',sleeves:'#ffffff',secondary:'#e6212d'},
  goalkeeper:{name:'Lei&Lui',style:'heather-raglan',number:'#ffffff',primary:'#ed1421',sleeves:'#ee5c65',secondary:'#ff9ea1'}
 };
 const result=collectionForClub({kits:saved});
 assert.deepEqual(Object.keys(result),Object.keys(saved));
 for(const [key,expected] of Object.entries(saved)){
  assert.deepEqual(result[key],expected);
  assert.ok(shirtSvg(result[key],'caselle-'+key,false).includes(expected.secondary));
 }
 assert.equal(newKitKey(result),'kit_3');
});
test('squadra senza kit inizia con uno; quelli vecchi restano modificabili',()=>{
 const fresh=collectionForClub({primary_color:'#111111',secondary_color:'#dddddd'});
 assert.deepEqual(Object.keys(fresh),['home']);
 assert.equal(fresh.home.primary,'#111111');
 assert.equal(normalizeKit({style:'nonsense'}).style,'stripes');
 const old=collectionForClub({kits:{old:{name:'Storica',style:'royal-stripes',primary:'#111111',secondary:'#eeeeee',sleeves:'#111111',number:'#ffffff'}}});
 assert.equal(old.old.style,'royal-stripes');
 assert.match(shirtSvg(old.old,'old'),/clipPath/);
});
test('campo partita e configurazione espongono sempre i kit scelti',()=>{
 assert.match(main,/data-match-kit-choice/);
 assert.match(main,/overviewLineup\(m,data,[^\n]+comp,activeKit\)/);
 assert.match(main,/tm_app_match_details/);
 assert.match(staff,/data-lineup-kit/);
 assert.match(pitch,/field-kit-shirt/);
 assert.match(css,/\.match-kit-grid/);
 assert.match(css,/\.kit-model-grid/);
});
