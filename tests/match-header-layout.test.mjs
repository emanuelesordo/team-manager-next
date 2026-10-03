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


test('match header collapses on scroll and keeps only crests, names and score',()=>{
 assert.match(matchSource,/class="match-header-sentinel"/);
 assert.match(css,/\.match-detail-head\.glass\{\s*position:sticky/);
 assert.match(css,/top:var\(--match-sticky-top,65px\)/);
 assert.match(css,/\.match-detail-head\.is-compact \.match-header-meta,\s*\.match-detail-head\.is-compact \.match-header-scorers,\s*\.match-detail-head\.is-compact \.match-score-status\{display:none\}/);
 assert.match(css,/\.match-detail-head\.is-compact \.match-header-team-away\{\s*flex-direction:row-reverse;/);
 assert.match(css,/\.match-detail-head\.is-compact \.match-header-team\{\s*display:flex;\s*flex-direction:row;/);
 assert.match(css,/\.match-detail-head\.is-compact \.match-header-team \.crest\.xl\{/);
 assert.match(css,/@media\(max-width:650px\)\{\s*\.match-detail-head\.is-compact/);
 assert.match(main,/window\.addEventListener\('scroll',syncMatchHeaderCompact,\{passive:true\}\)/);
});
test('scroll observer toggles compact state without regenerating the match',()=>{
 const start=main.indexOf('function syncMatchHeaderCompact(){');
 const end=main.indexOf('function sizeClubEditor(){',start);
 assert.ok(start>=0&&end>start);
 let markerBottom=400,compact=false,offset=null;
 const head={
  style:{setProperty(name,value){if(name==='--match-sticky-top')offset=value}},
  classList:{toggle(name,on){assert.equal(name,'is-compact');compact=on}}
 };
 const dom={
  '.match-detail-head':head,
  '.match-header-sentinel':{getBoundingClientRect(){return {bottom:markerBottom}}},
  '.topbar':{getBoundingClientRect(){return {height:68,bottom:68}}}
 };
 const document={querySelector:selector=>dom[selector]};
 const state={page:'match'};
 const handler=new Function('document','state',main.slice(start,end)+';return syncMatchHeaderCompact;')(document,state);
 handler();assert.equal(compact,false);assert.equal(offset,'68px');
 markerBottom=70;handler();assert.equal(compact,true);
 markerBottom=300;handler();assert.equal(compact,false);
 state.page='calendar';markerBottom=0;handler();assert.equal(compact,false);
});
