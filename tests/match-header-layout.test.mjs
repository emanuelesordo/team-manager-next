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
