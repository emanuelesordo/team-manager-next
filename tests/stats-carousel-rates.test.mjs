import test from 'node:test';
import assert from 'node:assert/strict';
import {nextStatSlide,nearestStatSlide,statSlideOffset} from '../fresh/stats-carousel.js';
import {enrichPlayerNumbers,ratePer80} from '../fresh/stat-rates.js';

test('carousel arrows reach every slide, including the final one',()=>{
 let current=0;
 for(let i=1;i<14;i++){
  current=nextStatSlide(current,1,14);
  assert.equal(current,i);
 }
 assert.equal(nextStatSlide(current,1,14),13);
 for(let i=12;i>=0;i--){current=nextStatSlide(current,-1,14);assert.equal(current,i)}
 assert.equal(nextStatSlide(0,-1,14),0);
 assert.equal(nextStatSlide(0,1,0),0);
});

test('snap offsets are normalized to the first slide, not viewport coordinates',()=>{
 const offsets=[221,977,1733,2489,3245];
 for(let i=0;i<offsets.length;i++){
  const left=statSlideOffset(offsets,i);
  assert.equal(left,i*756);
  assert.equal(nearestStatSlide(offsets,left),i);
 }
 assert.equal(nearestStatSlide(offsets,2240),3);
});

test('verified minutes yield exact per-80 rates, never average rates across matches',()=>{
 const players=[{player_id:'a',first_name:'Anna',last_name:'Rossi',minutes:123,minutes_coverage:'complete',
   appearances:5,starts:3,goals:4,assists:1,yellow_cards:2,red_cards:0,disciplinary_cards:2,
   goals_for_on:5,goals_against_on:3,plus_minus_on:2,impact_coverage:'complete'},
 {player_id:'b',last_name:'Bianchi',minutes:null,minutes_coverage:'unavailable',
   appearances:2,starts:2,goals:1,assists:0,yellow_cards:1}];
 const r=enrichPlayerNumbers(players,[],[{player_id:'a',equalizers:2,go_ahead_goals:1}],[],new Map([['a',2]]));
 const a=r.find(x=>x.player_id==='a'),b=r.find(x=>x.player_id==='b');
 assert.equal(a.goals_assists,5);
 assert.ok(Math.abs(a.goals_assists_per_80-400/123)<1e-8);
 assert.ok(Math.abs(a.yellows_per_80-160/123)<1e-8);
 assert.ok(Math.abs(a.equalizers_per_80-160/123)<1e-8);
 assert.equal(a.starts_per_game,60);
 assert.equal(a.mvp_per_game,.4);
 assert.equal(b.goals_assists_per_80,null);
 assert.equal(b.yellows_per_80,null);
 assert.equal(ratePer80(5,0,'complete'),null);
});
test('known zero is different from an unavailable metric',()=>{
 const r=enrichPlayerNumbers([{player_id:'x',appearances:4,goals:0,assists:0,minutes:320,minutes_coverage:'complete'}]);
 assert.equal(r[0].goals_assists_per_80,0);
 assert.equal(r[0].goals_assists_per_game,0);
 assert.equal(r[0].gf_on_per_game,null);
});
