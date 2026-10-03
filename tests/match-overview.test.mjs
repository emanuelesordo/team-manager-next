import test from 'node:test';
import assert from 'node:assert/strict';
import {overviewLineup,playerMatchEvents,relativeRating} from '../fresh/match-overview.js';

const competition={minutes_per_period:40};
const people=[{id:'a',first_name:'Mario',last_name:'Rossi'},{id:'b',first_name:'Luca',last_name:'Verdi'}];
const game={
 players:[{player_id:'a',started:true,tactical_slot:1,shirt_number:1,selection_status:'starter'},
  {player_id:'b',started:false,selection_status:'bench',shirt_number:12}],
 events:[{event_type:'goal',player_id:'a',secondary_player_id:'b',minute:28,
  payload:{period:'second_half'},validation_status:'official'}],
 ratingMeans:[{player_id:'a',avg_rating:7.2,votes:4},{player_id:'b',avg_rating:5.5,votes:2}],
 ratings:[]
};
const season=[{player_id:'a',avg_rating:6.1},{player_id:'b',avg_rating:6.5}];

test('overview includes starters and bench, individual events, not invented opponents',()=>{
 const html=overviewLineup({formation:'4-4-2'},game,people,season,competition);
 assert.match(html,/Formazione titolare/);
 assert.match(html,/Panchina/);
 assert.match(html,/M\\. Rossi/);
 assert.match(html,/L\\. Verdi/);
 assert.match(html,/ov-pitch/);
 assert.match(html,/ov-bench/);
 assert.match(html,/ov-goal/);
 assert.match(html,/ov-assist/);
 assert.match(html,/ov-rating-high/);
 assert.match(html,/ov-rating-low/);
});
test('historical events display cumulative minute and assistant attribution',()=>{
 const a=playerMatchEvents('a',game.events,competition);
 const b=playerMatchEvents('b',game.events,competition);
 assert.equal(a.length,1);
 assert.equal(a[0].minute,68);
 assert.equal(a[0].kind,'goal');
 assert.equal(b[0].kind,'assist');
 assert.equal(b[0].minute,68);
});
test('relative rating compares game vote with individual seasonal average',()=>{
 assert.equal(relativeRating('a',game,season).level,'high');
 assert.equal(relativeRating('b',game,season).level,'low');
 assert.equal(relativeRating('unknown',game,season),null);
 assert.equal(relativeRating('a',game,[]).level,'unrated');
});
test('rejected personal events are hidden',()=>{
 const hidden=[...game.events,{event_type:'yellow_card',player_id:'a',minute:29,validation_status:'rejected'}];
 assert.equal(playerMatchEvents('a',hidden,competition).length,1);
});
