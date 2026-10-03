import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const main=readFileSync(new URL('../fresh/main.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../fresh/style.css',import.meta.url),'utf8');
const staff=readFileSync(new URL('../fresh/staff-ui.js',import.meta.url),'utf8');
const staffCss=readFileSync(new URL('../fresh/staff.css',import.meta.url),'utf8');

test('page titles are rendered inside the shared header instead of content',()=>{
 assert.match(main,/function heading\(\)\{return ''\}/);
 assert.match(main,/function topbarPage\(\)/);
 for(const page of ['home','competitions','calendar','roster','stats','match','player','club','admin','account'])
  assert.match(main,new RegExp(page+':\\['));
 assert.match(main,/class="topbar-page"/);
 assert.match(main,/topbarPage\(\)\[1\]/);
});
test('admin setup has tabs without page hero and repeated heading',()=>{
 assert.doesNotMatch(staff,/return ctx\.heading\('CENTRO DI CONTROLLO'/);
 assert.doesNotMatch(staff,/staff-intro glass/);
 assert.match(staff,/data-staff-area/);
});
test('sidebar keeps accessible lower actions while scrolling only navigation',()=>{
 assert.match(main,/class="sidebar-scroll"/);
 assert.match(main,/class="sidebar-bottom"/);
 assert.match(css,/\.sidebar-scroll\{flex:1 1 auto;min-height:0;overflow-y:auto/);
 assert.match(css,/\.sidebar-bottom\{flex:0 0 auto/);
 assert.match(css,/height:100dvh;max-height:100dvh/);
 assert.match(css,/\.overlay \.menu-sheet\{max-height:calc\(100dvh - 32px\);overflow-y:auto/);
});

test('drawer distributes excess viewport space without moving season and account',()=>{
 assert.match(css,/\.sidebar-scroll \.side-nav\{[^}]*justify-content:space-around/);
 assert.match(css,/\.sidebar-scroll \.side-nav:first-of-type\{flex-grow:2\}/);
 assert.match(css,/max-height:690px/);
 assert.match(css,/\.sidebar-bottom\{flex:0 0 auto/);
});
test('logo crop and palette occupy adjacent explicit tracks, never a tall implicit row',()=>{
 assert.match(staffCss,/\.staff-editor-club \.logo-editor-main\{[\s\S]*?display:grid;[\s\S]*?grid-template-rows:max-content/);
 assert.match(staffCss,/\.staff-editor-club \.logo-crop-column\{[\s\S]*?grid-area:1\/1\/2\/2/);
 assert.match(staffCss,/\.staff-editor-club \.logo-palette-side\{[\s\S]*?grid-area:1\/2\/2\/3/);
 assert.match(staffCss,/@container \(max-width:620px\)\{/);
 assert.match(staffCss,/grid-area:2\/1\/3\/2/);
 assert.doesNotMatch(staffCss,/@container \(max-width:650px\)/);
});
test('club editor keeps independent scroll with no giant grid row',()=>{
 assert.match(main,/function sizeClubEditor\(\)/);
 assert.match(main,/window\.addEventListener\('resize',sizeClubEditor\)/);
 assert.match(staffCss,/\.staff-editor-club \.staff-team-details,\.staff-editor-club \.staff-team-brand\{[^}]*overflow-x:hidden;overflow-y:auto/);
 assert.match(staffCss,/\.staff-editor-club \.logo-editor-main\{[\s\S]*?display:grid/);
 assert.match(staffCss,/@media\(max-width:760px\)/);
});


test('home carousel has no top labels, uses Dettagli match, and shares desktop card height',()=>{
 const hero=main.slice(main.indexOf('function hero(){'),main.indexOf('function kpis(){'));
 assert.doesNotMatch(hero,/class="hero-title"/);
 assert.doesNotMatch(hero,/class="hero-season"/);
 assert.doesNotMatch(hero,/MATCH CENTER/);
 assert.match(hero,/Dettagli match/);
 assert.match(css,/@media\(min-width:961px\)\{\s*\.home-feature\{align-items:stretch\}/);
 assert.match(css,/\.home-feature>\.feature-primary\{\s*display:flex;flex-direction:column;align-self:stretch/);
 assert.match(css,/\.home-feature>\.feature-primary>\.hero-panel\{\s*display:flex;flex:1 1 auto;align-self:stretch/);
 assert.match(css,/\.home-feature>\.feature-aside\{align-self:stretch;height:100%;min-height:0\}/);
});
