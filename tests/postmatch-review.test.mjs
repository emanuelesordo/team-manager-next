import test from 'node:test';import assert from 'node:assert/strict';
import {reviewSummary,reviewPanel} from '../fresh/postmatch-review.js';
const match={id:'M',home_away:'away',status:'finished',home_score:0,away_score:0};
const fixture={home_score:1,away_score:4};
test('no events: final result can be official without named scorer',()=>{
 const info=reviewSummary(match,fixture,[]);assert.equal(info.officialGoals.home,0);assert.equal(info.pending,0);
 assert.match(reviewPanel({match,fixture}),/Nessun evento/);
});
test('historic proposals remain proposed until staff manually approves',()=>{
 const events=[{id:'e1',event_type:'goal',team_side:'team',minute:null,validation_status:'proposed'},
 {id:'e2',event_type:'goal',team_side:'opponent',minute:43,stoppage_minute:3,validation_status:'official'},
 {id:'e3',event_type:'red_card',team_side:'opponent',minute:74,validation_status:'proposed'}];
 const s=reviewSummary(match,fixture,events);assert.equal(s.pending,2);assert.equal(s.officialGoals.home,1);assert.equal(s.officialGoals.away,0);
 const html=reviewPanel({match,fixture,events});assert.match(html,/Minuto non noto/);assert.match(html,/43\+3/);assert.match(html,/data-staff-action="review-approve"/);assert.match(html,/divergono/);
});
test('own goal beneficiary is inverted; rejected goals never count',()=>{
 const x=reviewSummary({home_away:'home'},fixture,[
 {event_type:'own_goal',team_side:'team',validation_status:'official'},
 {event_type:'goal',team_side:'team',validation_status:'rejected'}]);
 assert.deepEqual(x.officialGoals,{home:0,away:1});
});
test('blue, changes and empty primary player do not invent individual stats',()=>{
 const html=reviewPanel({match,fixture,events:[
 {id:'a',event_type:'blue_card',validation_status:'official',team_side:'team',minute:null},
 {id:'b',event_type:'substitution',validation_status:'proposed',team_side:'team',minute:72}
 ]});
 assert.match(html,/Cartellino blu/);assert.match(html,/Cambio/);
 assert.match(html,/non indicato/);assert.doesNotMatch(html,/data-staff-action="review-reject" data-event-id="a"/);
});
test('score-counted event requires manual scoreboard review before rejection',()=>{
 const html=reviewPanel({match,fixture,events:[{id:'c',event_type:'goal',validation_status:'proposed',team_side:'team',payload:{counted_in_score:true}}]});
 assert.match(html,/rettificare prima il risultato/);
 assert.doesNotMatch(html,/data-staff-action="review-reject" data-event-id="c"/);
});
