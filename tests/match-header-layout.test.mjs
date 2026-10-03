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
test('match header displays three top metadata pairs, no Match Center label or separators',()=>{
 assert.ok(matchSource.includes('match-meta-left'));
 assert.ok(matchSource.includes('match-meta-center'));
 assert.ok(matchSource.includes('match-meta-right'));
 assert.ok(matchSource.indexOf("titleInfo('Competizione'")<matchSource.indexOf("titleInfo('Giornata'"));
 assert.ok(matchSource.indexOf("titleInfo('Data'")<matchSource.indexOf("titleInfo('Ora'"));
 assert.ok(matchSource.indexOf("titleInfo('Luogo'")<matchSource.indexOf("titleInfo('Campo'"));
 assert.ok(matchSource.indexOf('const matchMeta=')<matchSource.indexOf('const header='));
 assert.doesNotMatch(matchSource,/<span>Match Center<\/span>/);
 assert.match(css,/match-header-meta\{[^}]*display:grid/);
 assert.match(css,/match-header-meta\{[^}]*border:0/);
});
test('status is above result with explicit dash; substitutions are tight',()=>{
 assert.ok(matchSource.includes("'<div class=\"match-big-score\"><div class=\"match-score-status\">'+status(f)"));
 assert.ok(matchSource.includes('match-score-separator'));
 assert.match(css,/\.match-detail-head \.match-big-score\{[^}]*flex-direction:column/);
 assert.match(css,/\.match-timeline \.mt-change\{[^}]*gap:0;line-height:10px/);
});


test('match header gradually crossfades metadata into outward crest / name / score / name / crest order',()=>{
 assert.match(matchSource,/class="match-expanded"/);
 assert.match(matchSource,/class="match-compact-bar"/);
 assert.match(matchSource,/class="match-compact-club match-compact-home"/);
 assert.match(matchSource,/class="match-compact-club match-compact-away"/);
 assert.match(matchSource,/class="match-compact-score"/);
 const compact=matchSource.slice(matchSource.indexOf("const compactHeader="),matchSource.indexOf(" const header=",matchSource.indexOf("const compactHeader=")));
 assert.ok(compact.indexOf("club(f.home_team")<compact.indexOf("E(f.home_team)"));
 assert.ok(compact.indexOf("E(f.home_team)")<compact.indexOf("headerScore"));
 assert.ok(compact.indexOf("headerScore")<compact.indexOf("E(f.away_team)"));
 assert.ok(compact.indexOf("E(f.away_team)")<compact.indexOf("club(f.away_team"));
 assert.match(css,/\.match-detail-head\.glass\{\s*position:sticky/);
 assert.match(css,/opacity:calc\(1 - var\(--match-collapse,0\)\)/);
 assert.match(css,/opacity:var\(--match-collapse,0\)/);
 assert.match(css,/\.match-compact-bar\{[\s\S]*?grid-template-columns/);
 assert.match(css,/@media\(max-width:650px\)/);
 assert.match(main,/window\.addEventListener\('scroll',syncMatchHeaderCompact,\{passive:true\}\)/);
});
test('scroll compression is proportional, reversible and does not regenerate the match',()=>{
 const start=main.indexOf('function syncMatchHeaderCompact(){');
 const end=main.indexOf('function sizeClubEditor(){',start);
 assert.ok(start>=0&&end>start);
 let markerBottom=420,compact=false;
 const vars=new Map();
 const expanded={getBoundingClientRect(){return {height:320}}};
 const head={
  dataset:{},style:{height:'',setProperty(k,v){vars.set(k,v)}},
  getBoundingClientRect(){return {width:900}},
  querySelector(selector){assert.equal(selector,'.match-expanded');return expanded},
  classList:{toggle(k,on){assert.equal(k,'is-compact');compact=on}}
 };
 const dom={
  '.match-detail-head':head,
  '.match-header-sentinel':{getBoundingClientRect(){return {bottom:markerBottom}}},
  '.topbar':{getBoundingClientRect(){return {height:68,bottom:68}}}
 };
 const document={querySelector:s=>dom[s]};
 const state={page:'match'};
 const win={innerWidth:1100};
 const handler=new Function('document','state','window',main.slice(start,end)+';return syncMatchHeaderCompact;')(document,state,win);
 handler();
 assert.equal(vars.get('--match-sticky-top'),'68px');
 assert.equal(vars.get('--match-collapse'),'0.0000');
 assert.equal(head.style.height,'320px');
 markerBottom=78-90;handler();
 assert.equal(vars.get('--match-collapse'),'0.5000');
 assert.equal(head.style.height,'197px');
 assert.equal(compact,false);
 markerBottom=-150;handler();
 assert.equal(vars.get('--match-collapse'),'1.0000');
 assert.equal(head.style.height,'74px');
 assert.equal(compact,true);
 markerBottom=420;handler();
 assert.equal(vars.get('--match-collapse'),'0.0000');
 assert.equal(head.style.height,'320px');
 assert.equal(compact,false);
 win.innerWidth=400;delete head.dataset.expandedHeight;
 markerBottom=-200;handler();
 assert.equal(head.style.height,'64px');
 assert.equal(compact,true);
 state.page='calendar';markerBottom=420;handler();
 assert.equal(head.style.height,'64px');
});

