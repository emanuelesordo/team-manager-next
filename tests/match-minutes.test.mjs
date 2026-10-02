import test from 'node:test';
import assert from 'node:assert/strict';
import {cumulativeEventMinute,storedEventMinute,displayEventMinute,matchPeriodLength} from '../fresh/match-minutes.js';
import {reviewPanel} from '../fresh/postmatch-review.js';
import {amendEventForm,revisionHistory} from '../fresh/postmatch-controls.js';

const competition={minutes_per_period:40};
const legacy={id:'old',minute:28,event_type:'goal',team_side:'opponent',validation_status:'official',payload:{period:'second_half'}};
const live={id:'live',minute:68,event_type:'goal',team_side:'opponent',validation_status:'official',payload:{entered_from:'tm_app_live'}};

test('40 minute competition converts legacy second-half events exactly once',()=>{
 assert.equal(matchPeriodLength(competition),40);
 assert.equal(cumulativeEventMinute({...legacy,minute:10},competition),50);
 assert.equal(cumulativeEventMinute(legacy,competition),68);
 assert.equal(cumulativeEventMinute({...legacy,minute:46},competition),86);
 assert.equal(cumulativeEventMinute(live,competition),68);
 assert.equal(cumulativeEventMinute({...legacy,minute:68,payload:{period:'second_half',minute_relative:false}},competition),68);
 assert.equal(cumulativeEventMinute({...legacy,minute:20,payload:{period:'first_half'}},competition),20);
 assert.equal(cumulativeEventMinute({...legacy,minute:null},competition),null);
});
test('editing displays cumulative minute but saves unchanged legacy storage convention',()=>{
 assert.equal(storedEventMinute(legacy,68,competition),28);
 assert.equal(storedEventMinute(live,68,competition),68);
 assert.equal(storedEventMinute(legacy,null,competition),null);
 assert.throws(()=>storedEventMinute(legacy,25,competition),/secondo tempo/);
 assert.throws(()=>storedEventMinute(legacy,68,null),/Durata/);
});
test('review, editor and revision history show 68 and not raw 28 minutes',()=>{
 const match={id:'m',home_away:'home',status:'finished'};
 const fixture={status:'finished',home_score:0,away_score:1};
 const review=reviewPanel({match,fixture,competition,events:[legacy]});
 assert.match(review,/68′/);
 assert.doesNotMatch(review,/28′/);
 const edit=amendEventForm(legacy,[],competition);
 assert.match(edit,/name="minute"[^>]*value="68"/);
 const history=revisionHistory([{reason:'Test',created_at:'2026-09-30T20:00:00Z',previous_record:legacy,next_record:{...legacy,minute:29}}],competition);
 assert.match(history,/68′/);assert.match(history,/69′/);
});
test('recovery appears with cumulative base plus added minutes',()=>{
 const e={...legacy,minute:40,stoppage_minute:3};
 assert.equal(displayEventMinute(e,competition),'80+3′');
 assert.equal(displayEventMinute({...legacy,minute:null},competition,'Minuto ignoto'),'Minuto ignoto');
});
