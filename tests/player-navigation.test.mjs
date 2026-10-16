import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {playerNavigation} from '../fresh/player-navigation.js';

const players=[
 {id:'p3',last_name:'Zanetti',first_name:'Luca'},
 {id:'p1',last_name:'Boschetto',first_name:'Marco'},
 {id:'p2',last_name:'Cabassa',first_name:'Davide'},
 {id:'old',last_name:'Abate',first_name:'Ex giocatore'}
];
const roster=[{player_id:'p1'},{player_id:'p2'},{player_id:'p3'},{player_id:'p2'}];

test('player header arrows traverse only seasonal roster in alphabetical order',()=>{
 const mid=playerNavigation(players,roster,'p2');
 assert.equal(mid.previous?.id,'p1');
 assert.equal(mid.next?.id,'p3');
 assert.equal(mid.total,3);
 assert.equal(mid.position,2);
 assert.equal(playerNavigation(players,roster,'p1').previous,null);
 assert.equal(playerNavigation(players,roster,'p3').next,null);
});
test('missing players and an unloaded season never generate erroneous navigation targets',()=>{
 assert.deepEqual(playerNavigation([],[],null),{previous:null,next:null,position:0,total:0});
 const missing=playerNavigation(players,roster,'old');
 assert.equal(missing.previous,null);
 assert.equal(missing.next,null);
 assert.equal(missing.position,0);
 assert.equal(missing.total,3);
});

test('player profile navigation lives in shared topbar, not the detail body',()=>{
 const main=readFileSync(new URL('../fresh/main.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../fresh/player-mockup.css',import.meta.url),'utf8');
 assert.match(main,/function playerTopbarNavigation\(\)/);
 assert.match(main,/data-player-back/);
 assert.match(main,/data-player-nav="-1"/);
 assert.match(main,/data-player-nav="1"/);
 assert.match(main,/state\.page==='player'&&state\.player\?playerTopbarNavigation\(\)/);
 assert.match(main,/if\(x\.dataset\.playerBack!==undefined\)\{navigate\('roster'\);return\}/);
 assert.match(main,/if\(x\.dataset\.playerNav!==undefined\)\{stepPlayer\(Number\(x\.dataset\.playerNav\)\);return\}/);
 const player=main.slice(main.indexOf('function player(){'),main.indexOf('function stats(){'));
 assert.doesNotMatch(player,/class="back-link"/);
 assert.match(css,/body\[data-page="player"\] \.player-topbar-page/);
 assert.match(css,/@media\(max-width:760px\)/);
});
