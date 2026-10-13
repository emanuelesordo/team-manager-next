import test from 'node:test';import assert from 'node:assert/strict';
import{resultSplit,eventCoverage,seasonNumbers}from '../fresh/analytics.js';
const team={id:'T',name:'Calcio Caselle',short_name:'CAS'};
const f=(home,away,hs,as,status='finished',id='f')=>({id,home_team:home,away_team:away,home_team_id:home==='Calcio Caselle'?'T':null,away_team_id:away==='Calcio Caselle'?'T':null,home_opponent_id:home==='Calcio Caselle'?null:'O',away_opponent_id:away==='Calcio Caselle'?null:'O',home_score:hs,away_score:as,status});
test('zero-zero counts as clean sheet, incomplete score ignored',()=>{
 const r=resultSplit([f('Calcio Caselle','A',0,0),f('B','Calcio Caselle',1,2,'finished','x'),f('C','Calcio Caselle',null,2,'finished','z')],team);
 assert.deepEqual([r.played,r.wins,r.draws,r.cleanSheets,r.gf,r.ga],[2,1,1,1,2,1]);
 assert.equal(r.away.played,1);
});
test('goals proposed or partial cannot trigger fabricated comeback',()=>{
 const fixture=f('Calcio Caselle','A',2,1),m={id:'m',fixture_id:'f'};
 const rows=[{match_id:'m',event_type:'goal',team_side:'team',minute:30,validation_status:'proposed'}];
 const r=eventCoverage([fixture],[m],rows,team);
 assert.equal(r.complete,0);assert.equal(r.comebacks,0);
});
test('fully verified timeline detects comeback without inferring causality',()=>{
 const fixture=f('Calcio Caselle','A',2,1),m={id:'m',fixture_id:'f'};
 const rows=[
 {match_id:'m',event_type:'goal',team_side:'opponent',minute:3,validation_status:'official',created_at:'x'},
 {match_id:'m',event_type:'goal',team_side:'team',minute:15,validation_status:'official',created_at:'y'},
 {match_id:'m',event_type:'goal',team_side:'team',minute:30,validation_status:'official',created_at:'z'}];
 const r=eventCoverage([fixture],[m],rows,team);
 assert.equal(r.complete,1);assert.equal(r.comebacks,1);assert.equal(r.comebackWins,1);
 assert.equal(r.goalSituations.behind,1);assert.equal(r.goalSituations.equal,1);
});

test('analytics uses UUID even when labels differ',()=>{const game={...f('Calcio Caselle','A',1,0),home_team:'Renamed club'};assert.equal(resultSplit([game],team).wins,1)});

test('half-time fallback is valid without a complete goal timeline',()=>{
 const fixture=f('Calcio Caselle','A',2,1),match={id:'m',fixture_id:'f'};
 const events=[{match_id:'m',event_type:'period_end',validation_status:'official',payload:{period:'first_half',score_home:0,score_away:1}}];
 const s=eventCoverage([fixture],[match],events,team);
 assert.equal(s.complete,0);
 assert.equal(s.halftime.sample,1);
 assert.equal(s.halftime.trailing.matches,1);
 assert.equal(s.halftime.trailing.wins,1);
 assert.equal(s.gameState.matches,0);
});

test('season goal quarters use one cumulative clock for mixed legacy and live periods',()=>{
 const fixture={...f('Calcio Caselle','A',2,0),competition_id:'c'};
 const match={id:'m',fixture_id:'f',competition_id:'c',status:'finished'};
 const events=[
  {match_id:'m',event_type:'goal',team_side:'team',minute:28,payload:{period:'second_half'},validation_status:'official'},
  {match_id:'m',event_type:'goal',team_side:'team',minute:63,payload:{period:'second_half',entered_from:'tm_app_live'},validation_status:'official'}
 ];
 const r=seasonNumbers([fixture],[match],events,team,[{id:'c',minutes_per_period:40,periods:2}]);
 assert.deepEqual(r.goalsByPeriod,[0,2]);
 assert.deepEqual(r.goalIntervals,[0,0,0,2]);
});
test('official clock sorts goal situations even when first goal is stored in 2T-relative format',()=>{
 const fixture={...f('Calcio Caselle','A',1,1),competition_id:'c'};
 const match={id:'m',fixture_id:'f',status:'finished',home_away:'home'};
 const events=[
  {match_id:'m',event_type:'goal',team_side:'team',minute:18,payload:{period:'second_half'},validation_status:'official'},
  {match_id:'m',event_type:'goal',team_side:'opponent',minute:55,payload:{period:'second_half',entered_from:'tm_app_live'},validation_status:'official'}
 ];
 const r=eventCoverage([fixture],[match],events,team,[{id:'c',minutes_per_period:40,periods:2}]);
 assert.equal(r.complete,1);
 assert.equal(r.goalSituations.behind,1);
});
