import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTeamProfile,confidenceLevel,profileHighlights} from '../fresh/team-profile.js';

const numbers={
 played:5,wins:3,draws:1,losses:1,gf:9,ga:4,cleanSheets:2,
 home:{played:3,wins:2,draws:1,losses:0,gf:6,ga:2},
 away:{played:2,wins:1,draws:0,losses:1,gf:3,ga:2},
 matches:[
  {goals:1,conceded:0,result:'W'},
  {goals:2,conceded:2,result:'D'},
  {goals:0,conceded:1,result:'L'},
  {goals:3,conceded:0,result:'W'},
  {goals:3,conceded:1,result:'W'}
 ]
};
const gameState={
 matches:3,leadHoldRate:.8,recoveryRate:.5,leadsTaken:5,leadsLost:1,trailsEntered:4,trailsRecovered:2,
 quickResponsesFor:2,quickResponsesAgainst:1,
 roles:{team:{equalizer:2,deficit_reduction:1},opponent:{equalizer:1,deficit_reduction:1}}
};

test('confidence tiers degrade with smaller event samples',()=>{
 const c=confidenceLevel({resultMatches:5,timelineMatches:2,eventMatches:1});
 assert.equal(c.A.level,'A');assert.equal(c.B.level,'B');assert.equal(c.C.level,'C');
 assert.ok(c.A.score>c.B.score);assert.ok(c.B.score>c.C.score);
});

test('team profile exists with results only',()=>{
 const p=buildTeamProfile({numbers,gameState:{},eventMatches:0});
 assert.equal(p.played,5);
 assert.ok(p.metrics.some(x=>x.key==='form'&&Number.isFinite(x.value)));
 assert.ok(p.metrics.some(x=>x.key==='clean-sheet'&&x.confidence==='A'));
 assert.equal(p.confidence.B.sample,0);
 assert.ok(p.overall>=0&&p.overall<=1);
});

test('team profile adds game-state features without replacing result metrics',()=>{
 const p=buildTeamProfile({numbers,gameState,eventMatches:3});
 assert.equal(p.confidence.A.sample,5);
 assert.equal(p.confidence.B.sample,3);
 assert.equal(p.metrics.find(x=>x.key==='lead-hold').value,.8);
 assert.equal(p.metrics.find(x=>x.key==='recovery').value,.5);
 assert.ok(profileHighlights(p).every(x=>['A','B','C'].includes(x.confidence)));
});
