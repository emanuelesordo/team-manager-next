import test from 'node:test';
import assert from 'node:assert/strict';
import {playerStintPoints} from '../fresh/player-stint-points.js';

const fixture=(h,a)=>({id:'f',status:'finished',home_score:h,away_score:a,competition_id:'c'});
const match={id:'m',fixture_id:'f',status:'finished',home_away:'home',competition_id:'c',minutes_per_period_override:40};
const competition={id:'c',minutes_per_period:40,periods:2};
const playerRows=[
 {match_id:'m',player_id:'starter',started:true},
 {match_id:'m',player_id:'bench',started:false}
];
const event=(event_type,minute,team_side,player_id=null,secondary_player_id=null)=>({
 match_id:'m',event_type,minute,team_side,player_id,secondary_player_id,
 validation_status:'official',payload:{period:minute>40?'second_half':'first_half',minute_relative:false}
});
test('bench player enters at 1-0 then concedes 0-2: partial loss and -3 points',()=>{
 const rows=playerStintPoints([match],playerRows,[
  event('goal',30,'team'),
  event('substitution',40,'team','starter','bench'),
  event('goal',50,'opponent'),event('goal',60,'opponent')
 ],[fixture(1,2)],[competition]);
 assert.deepEqual(rows.get('bench'),{stint_games:1,stint_gf:0,stint_ga:2,stint_points:0,stint_points_delta:-3});
});
test('bench player enters at 1-0 and ends 1-1: -2 points',()=>{
 const rows=playerStintPoints([match],playerRows,[
  event('goal',30,'team'),
  event('substitution',40,'team','starter','bench'),
  event('goal',55,'opponent')
 ],[fixture(1,1)],[competition]);
 assert.deepEqual(rows.get('bench'),{stint_games:1,stint_gf:0,stint_ga:1,stint_points:0,stint_points_delta:-2});
});
test('missing a scored goal excludes unverified stint, not an invented zero',()=>{
 const rows=playerStintPoints([match],playerRows,[
  event('substitution',40,'team','starter','bench'),
  event('goal',55,'opponent')
 ],[fixture(1,1)],[competition]);
 assert.equal(rows.has('bench'),false);
});
