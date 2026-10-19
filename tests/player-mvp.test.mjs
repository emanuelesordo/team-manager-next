import test from 'node:test';
import assert from 'node:assert/strict';
import {matchMvpAwards,describePlayerSeason} from '../fresh/player-mvp.js';

test('MVP belongs to the highest average, not the most individual votes',()=>{
 const matches=[{id:'m1',status:'finished'}];
 const ratings=[
  {match_id:'m1',player_id:'a',rating:9},
  {match_id:'m1',player_id:'a',rating:5},
  {match_id:'m1',player_id:'b',rating:8}
 ];
 const result=matchMvpAwards(matches,ratings);
 assert.deepEqual(result.awards.map(x=>x.player_id),['b']);
 assert.equal(result.counts.get('b'),1);
});
test('SV, unfinished and test games do not earn awards',()=>{
 const result=matchMvpAwards(
  [{id:'a',status:'finished'},{id:'b',status:'live'},{id:'c',status:'finished',is_test:true}],
  [{match_id:'a',player_id:'p',rating:null},{match_id:'b',player_id:'p',rating:9},{match_id:'c',player_id:'p',rating:10}]
 );
 assert.equal(result.awards.length,0);
});
test('Equal top averages share the prize and count once per match',()=>{
 const result=matchMvpAwards([{id:'a',status:'finished'},{id:'b',status:'finished'}],[
  {match_id:'a',player_id:'p',rating:7},{match_id:'a',player_id:'q',rating:8},
  {match_id:'a',player_id:'p',rating:9},{match_id:'b',player_id:'p',rating:6}
 ]);
 assert.equal(result.counts.get('p'),2);
 assert.equal(result.counts.get('q'),1);
});
test('Player summary never claims invented results',()=>{
 assert.match(describePlayerSeason({appearances:3,starts:3,minutes:170,goals:2,assists:1,avg_rating:7.5},1),/2 gol/);
 assert.match(describePlayerSeason({appearances:0},0),/Non ci sono ancora/);
});
