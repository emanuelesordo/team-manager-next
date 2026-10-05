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
 assert.match(html,/M\. Rossi/);
 assert.match(html,/L\. Verdi/);
 assert.match(html,/ov-pitch/);
 assert.match(html,/ov-bench/);
 assert.match(html,/ov-icon-goal/);
 assert.match(html,/ov-icon-assist/);
 assert.match(html,/ov-rating-above/);
 assert.match(html,/ov-rating-below/);
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
test('relative rating uses only the current match votes, without season comparisons',()=>{
 assert.equal(relativeRating('a',game,season).level,'above');
 assert.equal(relativeRating('b',game,season).level,'below');
 assert.equal(relativeRating('unknown',game,season),null);
 assert.equal(relativeRating('a',game,[]).level,'above');
});
test('rejected personal events are hidden',()=>{
 const hidden=[...game.events,{event_type:'yellow_card',player_id:'a',minute:29,validation_status:'rejected'}];
 assert.equal(playerMatchEvents('a',hidden,competition).length,1);
});

test('multiple goals and assists aggregate into right-side counters without duplicate field number',()=>{
 const many={...game,events:[
  {event_type:'goal',player_id:'a',minute:12,validation_status:'official'},
  {event_type:'goal',player_id:'a',minute:31,validation_status:'official'},
  {event_type:'assist',player_id:'a',minute:15,validation_status:'official'},
  {event_type:'assist',player_id:'a',minute:28,validation_status:'official'},
  {event_type:'yellow_card',player_id:'a',minute:37,validation_status:'official'},
  {event_type:'substitution',player_id:'a',secondary_player_id:'b',minute:69,validation_status:'official'}
 ]};
 const html=overviewLineup({formation:'4-4-2'},many,people,season,competition,{primary:'#ffffff',secondary:'#111111'});
 const field=html.slice(html.indexOf('class="visual-field'),html.indexOf('</div></div></div></div>')+24);
 assert.match(html,/ov-marker-side-left/);
 assert.match(html,/ov-marker-side-right/);
 assert.match(html,/ov-icon-goal[^"]*"[^>]*>[\s\S]*?ov-marker-count">2<\/small>/);
 assert.match(html,/ov-icon-assist[^"]*"[^>]*>[\s\S]*?ov-marker-count">2<\/small>/);
 assert.match(html,/ov-icon-yellow_card/);
 assert.match(html,/ov-icon-sub_out/);
 assert.match(html,/ov-marker-art/);
 assert.match(html,/Voto medio partita: 7.20/);
 assert.doesNotMatch(field,/class="ov-shirt"/);
});

test('rating colors differentiate excellent from exceptional and double sanctions are supported',()=>{
 const richer={...game,players:[game.players[0]],events:[
  {event_type:'second_yellow',player_id:'a',minute:37,validation_status:'official'},
  {event_type:'red_card',player_id:'a',minute:38,payload:{card_type:'second_yellow_blue'},validation_status:'official'}
 ],ratingMeans:[{player_id:'a',avg_rating:9.2,votes:5}]};
 const html=overviewLineup({formation:'4-4-2'},richer,people,season,competition);
 assert.match(html,/ov-rating-elite/);
 assert.match(html,/ov-icon-double_card/);
 assert.match(html,/ov-event-double-card/);
 assert.match(html,/#378be7/);
});

test('an explicit assist and a goal-linked assist at the same minute count once',()=>{
 const combined=[{event_type:'goal',player_id:'a',secondary_player_id:'b',minute:20,validation_status:'official'},
  {event_type:'assist',player_id:'b',minute:20,validation_status:'official'}];
 assert.equal(playerMatchEvents('b',combined,competition).filter(x=>x.kind==='assist').length,1);
});

test('pitch event icons are naked glyphs and substitutions preserve in/out direction',()=>{
 const sample={...game,events:[
  {event_type:'substitution',player_id:'a',secondary_player_id:'b',minute:60,validation_status:'official'},
  {event_type:'yellow_card',player_id:'a',minute:30,validation_status:'official'},
  {event_type:'goal',player_id:'a',minute:40,validation_status:'official'}
 ]};
 const html=overviewLineup({formation:'4-4-2'},sample,people,season,competition);
 assert.match(html,/ov-icon-sub_out/);
 assert.equal(playerMatchEvents('b',sample.events,competition).some(x=>x.kind==='sub_in'),true);
 assert.match(html,/ov-icon-yellow_card/);
 assert.match(html,/ov-event-card/);
 assert.match(html,/ov-icon-goal/);
 assert.doesNotMatch(html,/ov-marker-badge/);
});

test('pitch and bench use the same event icon renderer',()=>{
 const shared={...game,events:[
  {event_type:'substitution',player_id:'a',secondary_player_id:'b',minute:60,validation_status:'official'},
  {event_type:'goal',player_id:'b',minute:68,validation_status:'official'}
 ]};
 const html=overviewLineup({formation:'4-4-2'},shared,people,season,competition,{primary:'#111',secondary:'#ffd400'});
 const pitch=html.slice(html.indexOf('ov-player-pitch'),html.indexOf('</div></div>',html.indexOf('ov-player-pitch'))+12);
 const bench=html.slice(html.indexOf('ov-bench'),html.indexOf('</section>'));
 assert.match(pitch,/ov-marker-icon ov-icon-sub_out/);
 assert.match(bench,/ov-marker-icon ov-icon-sub_in/);
 assert.match(bench,/ov-marker-icon ov-icon-goal/);
 assert.doesNotMatch(bench,/class="ov-event /);
});
