import test from 'node:test';import assert from 'node:assert/strict';
import {amendEventForm,resultReviewSection,revisionHistory} from '../fresh/postmatch-controls.js';
const f={status:'finished',home_score:1,away_score:4};
const m={id:'x',status:'finished',home_score:0,away_score:0,result_review_status:'provisional'};
test('result confirmation blocked on pending events and mismatch',()=>{
 const html=resultReviewSection(m,f,{scoreMismatch:true,pending:16,fixtureHasScore:true,matchHasScore:true});
 assert.match(html,/Allinea solo il tabellino/);assert.match(html,/disabled/);assert.match(html,/16 eventi/);
});
test('confirmed result has explicit reopen control',()=>{
 const html=resultReviewSection({...m,result_review_status:'confirmed'},f,{pending:0,scoreMismatch:false});
 assert.match(html,/Riapri verifica/);assert.doesNotMatch(html,/Allinea solo il tabellino/);
});
test('no fabricated scorer required to confirm official result',()=>{
 const html=resultReviewSection({...m,home_score:1,away_score:4},f,{pending:0,scoreMismatch:false,fixtureHasScore:true,matchHasScore:true});
 assert.match(html,/Conferma risultato definitivo/);assert.doesNotMatch(html,/ disabled/);
});
test('event correction validates required reason and preserves optional minute',()=>{
 const html=amendEventForm({id:'e1',event_type:'goal',team_side:'team',minute:null,validation_status:'official',payload:{counted_in_score:true}});
 assert.match(html,/data-staff-form="amend-event"/);assert.match(html,/minlength="5"/);assert.match(html,/Evento conteggiato/);
 for(const n of ['event_type','team_side','player_id','secondary_player_id','minute','stoppage_minute','notes','substitution_reason'])assert.match(html,new RegExp('name="'+n+'"'));
});
test('revision history escapes untrusted text',()=>{
 const html=revisionHistory([{created_at:'2026-10-02T10:00:00Z',reason:'<script>alert(1)</script>',previous_record:{event_type:'goal'},next_record:{event_type:'own_goal'}}]);
 assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;/);
});
