import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {matchPlayerLabel} from '../fresh/match-player-label.js';

const main=readFileSync(new URL('../fresh/main.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../fresh/style.css',import.meta.url),'utf8');
const matchSource=main.slice(main.indexOf('function match(){'),main.indexOf('function clubScreen(){'));
test('match player names use N. Cognome with stable fallback',()=>{
 assert.equal(matchPlayerLabel({first_name:'Mattia',last_name:'Costa'}),'M. Costa');
 assert.equal(matchPlayerLabel({first_name:'Dino',last_name:'De Marco'}),'D. De Marco');
 assert.equal(matchPlayerLabel({first_name:'',last_name:'Cabassa'}),'Cabassa');
 assert.equal(matchPlayerLabel(null),'Giocatore non censito');
});
test('match header keeps date/time over status and small metadata at the bottom corners',()=>{
 assert.ok(matchSource.includes('match-header-footer-meta'));
 assert.ok(matchSource.includes('match-footer-info-left'));
 assert.ok(matchSource.includes('match-footer-info-right'));
 assert.ok(matchSource.indexOf('<small>Competizione</small>')<matchSource.indexOf('<small>Giornata</small>'));
 assert.ok(matchSource.includes('<small>Campo</small>'));
 const headerBlock=matchSource.slice(matchSource.indexOf('const header='),matchSource.indexOf('const resultStatus='));
 assert.ok(headerBlock.indexOf('match-score-datetime')<headerBlock.indexOf('match-score-status'));
 assert.ok(headerBlock.includes('shortDate(f.kickoff_at)'));
 assert.ok(headerBlock.includes('time(f.kickoff_at)'));
 assert.doesNotMatch(headerBlock,/match-header-meta/);
 assert.doesNotMatch(matchSource,/<span>Match Center<\/span>/);
 assert.match(css,/match-header-footer-meta\{[^}]*display:flex/);
 assert.match(css,/match-score-datetime\{[^}]*font-size:10px/);
});
test('status is above result with explicit dash; substitutions are tight',()=>{
 assert.ok(matchSource.includes('<div class="match-score-status">'));
 assert.ok(matchSource.includes('match-score-separator'));
 assert.match(css,/\.match-detail-head \.match-big-score\{[^}]*flex-direction:column/);
 assert.match(css,/\.match-timeline \.mt-change\{[^}]*gap:0;line-height:10px/);
});


test('compact layout preserves crest, name, result, name, crest order',()=>{
 assert.match(matchSource,/class="match-expanded"/);
 assert.match(matchSource,/class="match-compact-bar glass"/);
 const compact=matchSource.slice(matchSource.indexOf("const compactHeader="),matchSource.indexOf(" const header=",matchSource.indexOf("const compactHeader=")));
 assert.ok(compact.indexOf("club(f.home_team")<compact.indexOf("E(f.home_team)"));
 assert.ok(compact.indexOf("E(f.home_team)")<compact.indexOf("headerScore"));
 assert.ok(compact.indexOf("headerScore")<compact.indexOf("E(f.away_team)"));
 assert.ok(compact.indexOf("E(f.away_team)")<compact.indexOf("club(f.away_team"));
 assert.match(css,/\.match-compact-bar\.glass\{\s*position:sticky/);
 assert.match(css,/margin-top:calc\(0px - var\(--match-compact-height,74px\) - 12px\)/);
 assert.match(css,/\.match-detail-head\.glass\{\s*position:relative/);
 assert.match(css,/@media\(max-width:650px\)/);
});
test('scroll animation is gradual, reversible and touches only opacity/transform',()=>{
 const start=main.indexOf('let matchHeaderFrame=0;');
 const end=main.indexOf('function sizeClubEditor(){',start);
 assert.ok(start>=0&&end>start);
 let bottom=400,reduced=false,frames=0;
 const tasks=[],properties=new Map();
 const compact={dataset:{},style:{setProperty(k,v){properties.set(k,v)}}};
 const expanded={style:{}};
 const head={style:{},getBoundingClientRect(){return {bottom}},
  querySelector(x){assert.equal(x,'.match-expanded');return expanded}};
 const document={querySelector:s=>({
  '.match-detail-head':head,'.match-compact-bar':compact,
  '.topbar':{getBoundingClientRect(){return {bottom:68}}}
 })[s]};
 const state={page:'match'};
 const window={innerWidth:1100,matchMedia:()=>({matches:reduced}),
  requestAnimationFrame(fn){frames++;tasks.push(fn);return frames}};
 const controller=new Function('document','state','window',
  main.slice(start,end)+';return {paintMatchHeaderCompact,syncMatchHeaderCompact};')(document,state,window);
 controller.paintMatchHeaderCompact();
 assert.equal(compact.style.opacity,'0.000');
 assert.equal(properties.get('--match-sticky-top'),'68px');
 bottom=227;
 controller.syncMatchHeaderCompact();controller.syncMatchHeaderCompact();
 assert.equal(tasks.length,1);
 tasks.shift()();
 assert.equal(compact.style.opacity,'0.500');
 assert.equal(expanded.style.opacity,'0.500');
 bottom=130;controller.syncMatchHeaderCompact();tasks.shift()();
 assert.equal(compact.style.opacity,'1.000');
 bottom=400;controller.syncMatchHeaderCompact();tasks.shift()();
 assert.equal(compact.style.opacity,'0.000');
 window.innerWidth=390;bottom=0;
 controller.syncMatchHeaderCompact();tasks.shift()();
 assert.equal(properties.get('--match-compact-height'),'64px');
 reduced=true;bottom=252;
 controller.syncMatchHeaderCompact();tasks.shift()();
 assert.equal(compact.style.opacity,'0.000');
 assert.equal(compact.style.transform,'none');
 assert.equal(head.style.height,undefined,'No layout-changing height updates');
 state.page='calendar';controller.syncMatchHeaderCompact();
 assert.equal(tasks.length,0);
});
