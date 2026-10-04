import test from 'node:test';
import assert from 'node:assert/strict';
import {availabilityDefault,disciplinarySuggestion,normalizedReason,unavailabilityReasons} from '../fresh/availability.js';
const when='2026-10-12T20:00:00+02:00';
const base={playerId:'p1',fixtureDate:when,matchId:'m2',competitionId:'c1',matches:[{id:'m1',competition_id:'c1',status:'finished',kickoff_at:'2026-10-05T20:00:00+02:00'}]};
test('four reasons and default technical absence',()=>{
 assert.deepEqual(unavailabilityReasons.map(x=>x[0]),['injury','suspension','personal','technical_choice']);
 assert.equal(normalizedReason('absent',''),'technical_choice');
 assert.equal(normalizedReason('starter','injury'),null);
 assert.equal(normalizedReason('absent','personal'),'personal');
});
test('saved choice always takes precedence over suggestions',()=>{
 assert.equal(availabilityDefault({...base,saved:{selection_status:'bench'},injuries:[{player_id:'p1',status:'active'}]}).status,'bench');
});
test('injury rolls forward from prior completed match, unless player recovered',()=>{
 const priorSelections=[{match_id:'m1',player_id:'p1',selection_status:'absent',unavailability_reason:'injury'}];
 assert.equal(availabilityDefault({...base,priorSelections}).reason,'injury');
 assert.equal(availabilityDefault({...base,priorSelections,injuries:[{player_id:'p1',status:'fit',actual_return:'2026-10-10'}]}).status,'available');
 assert.equal(availabilityDefault({...base,injuries:[{player_id:'p1',status:'active',injury_date:'2026-10-01'}]}).source,'injury');
});
test('registered suspension is offered only while active',()=>{
 assert.equal(availabilityDefault({...base,suspensions:[{player_id:'p1',status:'active',matches_count:1,matches_served:0}]}).reason,'suspension');
 assert.equal(availabilityDefault({...base,suspensions:[{player_id:'p1',status:'active',matches_count:1,matches_served:1}]}).status,'available');
});
test('discipline rules propose a ban after the fifth yellow in latest played match',()=>{
 const matches=Array.from({length:5},(_,i)=>({id:'m'+i,competition_id:'c1',status:'finished',kickoff_at:'2026-09-'+String(i+1).padStart(2,'0')+'T19:00:00Z'}));
 const disciplinaryEvents=matches.map(m=>({match_id:m.id,player_id:'p1',team_side:'own',event_type:'yellow_card'}));
 const props={...base,matches,disciplinaryEvents,competitionRules:{yellow_thresholds:[5,4,3,2]}};
 assert.equal(disciplinarySuggestion(props),true);
 assert.equal(availabilityDefault(props).reason,'suspension');
 assert.equal(disciplinarySuggestion({...props,matchId:'m-new',fixtureDate:'2026-09-04T20:00:00Z'}),false);
 assert.equal(disciplinarySuggestion({...props,disciplinaryEvents:disciplinaryEvents.slice(0,4)}),false);
});
test('opponents cards do not cause bans and prior match red is detected',()=>{
 const props={...base,disciplinaryEvents:[{match_id:'m1',player_id:'p1',team_side:'opponent',event_type:'red_card'}]};
 assert.equal(disciplinarySuggestion(props),false);
 assert.equal(disciplinarySuggestion({...props,disciplinaryEvents:[{...props.disciplinaryEvents[0],team_side:'own'}]}),true);
});
