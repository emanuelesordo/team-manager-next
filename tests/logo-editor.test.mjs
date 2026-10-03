import test from 'node:test';
import assert from 'node:assert/strict';
import {extractLogoColors,logoPicker,reorderLogoColors,normalizeLogoBackgroundColor} from '../fresh/logo-editor.js';

test('the logo color extractor returns 3 distinct dominant colors from opaque pixels',()=>{
 const data=new Uint8ClampedArray(64*4);
 const colors=[[230,30,20],[23,145,44],[27,60,200]];
 for(let i=0;i<64;i++){
  const color=i%8<3?colors[0]:i%8<6?colors[1]:colors[2];
  data.set([...color,255],i*4);
 }
 const palette=extractLogoColors({data});
 assert.equal(palette.length,3);
 assert.equal(new Set(palette).size,3);
 assert.ok(palette.includes('#e61e14'));
 assert.ok(palette.includes('#17912c'));
 assert.ok(palette.includes('#1b3cc8'));
});

test('logos use a shared mask and three editable ordered colors',()=>{
 const html=logoPicker('https://example.org/badge.png',['#112233','#445566','#778899'],'circle',true);
 assert.match(html,/data-shape="circle"/);
 assert.match(html,/data-logo-shape-select/);
 assert.match(html,/value="circle" selected/);
 assert.equal((html.match(/data-color-slot=/g)||[]).length,3);
 for(const field of ['primary_color','secondary_color','accent_color'])assert.ok(html.includes('name="'+field+'"'));
 assert.match(html,/data-logo-shift="-1"/);
 assert.match(html,/data-logo-shift="1"/);
 assert.match(html,/data-logo-edit-existing/);
 assert.match(html,/data-logo-canvas/);
 assert.match(html,/data-logo-zoom/);
});
test('opponent editor reuses the same shared shape without editing team-wide settings',()=>{
 const html=logoPicker('',[], 'rounded',false);
 assert.match(html,/data-shape="rounded"/);
 assert.doesNotMatch(html,/data-logo-shape-select/);
 assert.equal((html.match(/data-color-slot=/g)||[]).length,3);
});

test('drag reorder changes priority without changing actual swatch colors',()=>{
 const a=['#112233','#445566','#778899'];
 assert.deepEqual(reorderLogoColors(a,2,0),['#778899','#112233','#445566']);
 assert.deepEqual(reorderLogoColors(a,0,2),['#445566','#778899','#112233']);
 assert.deepEqual(a,['#112233','#445566','#778899']);
 assert.deepEqual(reorderLogoColors(a,-1,9),a);
});

test('background color stays optional and is a separate saved value from the PNG',()=>{
 const html=logoPicker('https://example.org/crest.png',['#112233','#445566','#778899'],'rounded',true,'#123abc');
 assert.match(html,/name="logo_background_color"/);
 assert.match(html,/data-logo-bg-value value="#123abc"/);
 assert.match(html,/data-logo-frame[^>]*background-color:#123abc/);
 for(const index of [0,1,2])assert.ok(html.includes('data-logo-bg-copy="'+index+'"'));
 assert.match(html,/data-logo-bg-picker/);
 assert.match(html,/data-logo-bg-clear/);
 assert.equal(normalizeLogoBackgroundColor('#AABBCC'),'#aabbcc');
 assert.equal(normalizeLogoBackgroundColor('#invalid'),null);
 const transparent=logoPicker('',[],'circle',false);
 assert.match(transparent,/data-logo-bg-value value=""/);
 assert.match(transparent,/background-color:transparent/);
});

test('logo workbench puts preview, controls, palette and backdrop in one balanced block',()=>{
 const html=logoPicker('https://example.org/crest.png',['#112233','#445566','#778899'],'rounded',true,'#223344');
 const crop=html.indexOf('data-logo-frame'),controls=html.indexOf('logo-editor-tools');
 const side=html.indexOf('logo-palette-side'),palette=html.indexOf('class="logo-colors"');
 const bg=html.indexOf('class="logo-background"');
 assert.ok(crop>=0&&crop<controls&&controls<side&&side<palette&&palette<bg);
 const voidTags=new Set(['img','input','br','hr','meta']);
 const stack=[];
 for(const tag of html.matchAll(/<\/?([a-z][a-z0-9-]*)\b[^>]*>/gi)){
  const name=tag[1].toLowerCase();
  if(voidTags.has(name))continue;
  if(tag[0].startsWith('</'))assert.equal(stack.pop(),name);
  else stack.push(name);
 }
 assert.deepEqual(stack,[]);
});
