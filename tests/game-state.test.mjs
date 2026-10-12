import test from 'node:test';
import assert from 'node:assert/strict';
import {analyseGoalTimeline,mergeGameStateAnalyses,goalRole} from '../fresh/game-state.js';

test('goalRole distingue apertura, accorciamento, pareggio, sorpasso e allungo',()=>{
 assert.equal(goalRole(0,0,'team'),'opener');
 assert.equal(goalRole(0,2,'team'),'deficit_reduction');
 assert.equal(goalRole(1,2,'team'),'equalizer');
 assert.equal(goalRole(2,2,'team'),'go_ahead');
 assert.equal(goalRole(3,2,'team'),'lead_extension');
});

test('analyseGoalTimeline ricostruisce game state e reazioni rapide',()=>{
 const goals=[
  {side:'opponent',minute:10},{side:'opponent',minute:20},
  {side:'team',minute:25},{side:'team',minute:32},
  {side:'team',minute:50},{side:'opponent',minute:55}
 ];
 const x=analyseGoalTimeline(goals,{sideOf:e=>e.side,minuteOf:e=>e.minute,duration:80,responseWindow:10});
 assert.equal(x.goalsFor,3);
 assert.equal(x.goalsAgainst,3);
 assert.equal(x.roles.team.deficit_reduction,1);
 assert.equal(x.roles.team.equalizer,1);
 assert.equal(x.roles.team.go_ahead,1);
 assert.equal(x.roles.opponent.opener,1);
 assert.equal(x.roles.opponent.lead_extension,1);
 assert.equal(x.roles.opponent.equalizer,1);
 assert.equal(x.trailsEntered,1);
 assert.equal(x.trailsRecovered,1);
 assert.equal(x.leadsTaken,1);
 assert.equal(x.leadsLost,1);
 assert.equal(x.quickResponsesFor,1);
 assert.equal(x.quickResponsesAgainst,1);
 assert.deepEqual(x.stateMinutes,{leading:5,drawing:35,trailing:40});
});

test('mergeGameStateAnalyses mantiene separati fatti e subiti',()=>{
 const a=analyseGoalTimeline([{side:'team',minute:10},{side:'opponent',minute:20}],{sideOf:e=>e.side,minuteOf:e=>e.minute,duration:80});
 const b=analyseGoalTimeline([{side:'opponent',minute:5},{side:'team',minute:15}],{sideOf:e=>e.side,minuteOf:e=>e.minute,duration:80});
 const x=mergeGameStateAnalyses([a,b]);
 assert.equal(x.matches,2);
 assert.equal(x.roles.team.opener,1);
 assert.equal(x.roles.opponent.opener,1);
 assert.equal(x.roles.team.equalizer,1);
 assert.equal(x.roles.opponent.equalizer,1);
 assert.equal(x.firstScored,1);
 assert.equal(x.firstConceded,1);
});

test('complete game states distinguish close-throughout from a reopened two-goal gap',()=>{
 const alwaysClose=analyseGoalTimeline([
  {side:'team',minute:14},{side:'opponent',minute:31}
 ],{sideOf:e=>e.side,minuteOf:e=>e.minute,duration:80});
 const reopened=analyseGoalTimeline([
  {side:'opponent',minute:5},{side:'opponent',minute:21},
  {side:'team',minute:45},{side:'team',minute:59}
 ],{sideOf:e=>e.side,minuteOf:e=>e.minute,duration:80});
 const summary=mergeGameStateAnalyses([alwaysClose,reopened]);
 assert.equal(summary.closeThroughout,1);
 assert.equal(summary.firstScored,1);
 assert.equal(summary.firstConceded,1);
 assert.equal(summary.firstScoredWinRate,0);
 assert.equal(summary.firstConcededLossRate,0);
 assert.equal(summary.pointsDroppedAfterFirst,2);
 assert.equal(summary.pointsRecoveredAfterFirstConceded,1);
 assert.equal(summary.progressions.team['0–2 → 1–2'],1);
 assert.equal(summary.progressions.team['1–2 → 2–2'],1);
 assert.equal(summary.doubleLeads,0);
 assert.equal(summary.opponentNarrowing,0);
});
