import test from 'node:test';import assert from 'node:assert/strict';
import {fixtureOnlyEvent,fixtureResult} from '../fresh/canonical-events.js';
import {cumulativeEventMinute} from '../fresh/match-minutes.js';
test('official fixture score is only score',()=>{assert.deepEqual(fixtureResult({home_score:1,away_score:4}),{home_score:1,away_score:4})});
test('external fixture event has no fabricated match or player',()=>{const row=fixtureOnlyEvent({fixture_id:'fixture',match_id:null,team_side:'home',payload:{legacy_fixture_score:{home:1,away:0}}});assert.equal(row.match_id,null);assert.equal(row.side,'home');assert.equal(row.home_score,1);assert.equal(row.player_id,undefined)});
test('absent snapshot remains null',()=>{const row=fixtureOnlyEvent({team_side:'away',payload:{}});assert.equal(row.home_score,null);assert.equal(row.away_score,null)});

test('imported second-half goal restores cumulative minute from source_raw',()=>{
 const source={minute:20,team_side:'home',source_raw:{period:'second_half'},payload:{origin:'legacy_fixture_event'}};
 const normalized=fixtureOnlyEvent(source);
 assert.equal(normalized.payload.period,'second_half');
 assert.equal(cumulativeEventMinute(normalized,{minutes_per_period:40}),60);
 assert.equal(source.payload.period,undefined);
});
