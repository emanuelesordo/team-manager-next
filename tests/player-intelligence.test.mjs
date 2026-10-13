import test from 'node:test';
import assert from 'node:assert/strict';
import {playerIntelligence,renderPlayerIntelligence} from '../fresh/player-intelligence.js';

const fixture={id:'f1',status:'finished',home_team_id:'team',away_team_id:'opp',home_score:2,away_score:1,competition_id:'c1',kickoff_at:'2026-10-01T20:00:00Z'};
const match={id:'m1',fixture_id:'f1',status:'finished'};
const competition={id:'c1',minutes_per_period:40,periods:2};
const base={fixtures:[fixture],matches:[match],matchPlayers:[{match_id:'m1',player_id:'p',started:false,selection_status:'bench'}],events:[
 {match_id:'m1',event_type:'goal',minute:30,team_side:'away',player_id:'opp'},
 {match_id:'m1',event_type:'substitution',minute:55,team_side:'home',player_id:'out',secondary_player_id:'p'},
 {match_id:'m1',event_type:'goal',minute:60,team_side:'home',player_id:'p'},
 {match_id:'m1',event_type:'goal',minute:70,team_side:'home',player_id:'other',secondary_player_id:'p'},
],competitions:[competition],team:{id:'team'}};

test('substitute: 25 minutes, +2 on field, goal and assist',()=>{
 const result=playerIntelligence('p',base);
 assert.equal(result.games,1);
 assert.equal(result.starts,0);
 assert.equal(result.minutes,25);
 assert.equal(result.goals,1);
 assert.equal(result.assists,1);
 assert.equal(result.subGoals,1);
 assert.equal(result.gfOn,2);
 assert.equal(result.gaOn,0);
 assert.equal(result.gfOff,0);
 assert.equal(result.gaOff,1);
 assert.equal(result.covered,1);
 assert.equal(result.entryPointsDelta,3);
 assert.ok(renderPlayerIntelligence('p',base).includes('Plus/minus'));
});
test('a missing goal minute suppresses on/off and preserves personal recorded goals',()=>{
 const broken={...base,events:base.events.map((e,i)=>i===2?{...e,minute:null}:e)};
 const result=playerIntelligence('p',broken);
 assert.equal(result.covered,0);
 assert.equal(result.goals,1);
 assert.equal(result.gfOn,0);
 assert.equal(result.matches[0].pm,null);
});
test('conflicting recorded minutes invalidate presence intervals',()=>{
 const changed={...base,matchPlayers:base.matchPlayers.map(x=>({...x,minutes_played:45}))};
 const result=playerIntelligence('p',changed);
 assert.equal(result.covered,0);
 assert.equal(result.minutesKnown,0);
});
test('rejected goals do not contribute to the statistics',()=>{
 const changed={...base,events:base.events.map((x,i)=>i===2?{...x,validation_status:'rejected'}:x)};
 const result=playerIntelligence('p',changed);
 assert.equal(result.goals,0);
 assert.equal(result.covered,0);
});
