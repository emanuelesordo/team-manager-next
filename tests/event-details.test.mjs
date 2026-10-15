import test from 'node:test';
import assert from 'node:assert/strict';
import {goalDistance,legacyChangeReason,eventAdvancedMarkup,mergeEventAdvanced} from '../fresh/event-details.js';
test('zone porta e distanze metriche',()=>{
 assert.deepEqual(goalDistance({x:34,y:3}),{meters:3,zone:'goal_area'});
 assert.deepEqual(goalDistance({x:34,y:11}),{meters:11,zone:'penalty_area'});
 assert.deepEqual(goalDistance({x:34,y:21}),{meters:21,zone:'16_25'});
 assert.deepEqual(goalDistance({x:34,y:30}),{meters:30,zone:'26_35'});
 assert.deepEqual(goalDistance({x:34,y:52}),{meters:52,zone:'over_35'});
 assert.equal(goalDistance({x:80,y:10}),null);
});
test('motivazioni e metadati non toccano chiavi punteggio',()=>{
 assert.equal(legacyChangeReason('physical_precaution'),'injury_prevention');
 assert.equal(legacyChangeReason('energy'),null);
 const p=mergeEventAdvanced({counted_in_score:true,period:'second_half'},{goal_details:{body_part:'head'},disciplinary_reason:null,substitution_motivation:null});
 assert.equal(p.counted_in_score,true);
 assert.deepEqual(p.goal_details,{body_part:'head'});
 assert.equal('disciplinary_reason' in p,false);
});
test('pannello gol e motiva solo il Caselle',()=>{
 const goal=eventAdvancedMarkup({payload:{goal_details:{body_part:'foot'}}},'goal','opponent');
 assert.match(goal,/data-event-pitch/);
 assert.match(goal,/name="goal_body_part"/);
 assert.match(goal,/option value="foot" selected/);
 const awayCard=eventAdvancedMarkup(null,'yellow_card','opponent');
 assert.match(awayCard,/data-event-advanced hidden/);
 const ours=eventAdvancedMarkup(null,'yellow_card','team');
 assert.match(ours,/data-event-group="discipline"/);
});
