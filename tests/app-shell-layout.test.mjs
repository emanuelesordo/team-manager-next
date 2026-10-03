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
test('team and opponent crest editor put palette beside crop on large desktop',()=>{
 assert.match(staffCss,/grid-template-areas:"upload upload" "crop colors" "crop background"/);
 assert.match(staffCss,/\.staff-editor-club \.logo-colors\{grid-area:colors/);
 assert.match(staffCss,/\.staff-editor-club \.logo-background\{grid-area:background/);
 assert.match(staffCss,/max-width:1080px/);
});
