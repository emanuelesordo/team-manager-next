import test from 'node:test';
import assert from 'node:assert/strict';
import {csiFixtureDifferences,csiReviewPanel} from '../fresh/csi-review.js';
const fixture={source_url:'https://live.centrosportivoitaliano.it/',kickoff_at:'2026-10-05T19:15:00Z',venue_name:'Campo',home_score:null,away_score:null};
const payload={date:'2026-10-05',time:'21:15',venue:{name:'Campo'},home:{score:null},away:{score:null}};
test('Rome time and unpublished scores have no false differences',()=>assert.deepEqual(csiFixtureDifferences(fixture,payload),[]));
test('date, time, venue and score proposals are rendered and escaped',()=>{
 const raw={...payload,date:'2026-10-06',time:'20:30',venue:{name:'<script>alert(1)</script>'},home:{score:2},away:{score:1}};
 assert.equal(csiFixtureDifferences(fixture,raw).length,4);
 const html=csiReviewPanel({fixture,snapshot:{raw_payload:raw,fetched_at:'2026-10-07T10:00:00Z'},check:{check_status:'error',last_error:'<img onerror=bad>'}});
 assert.match(html,/proposta CSI/);assert.match(html,/Controllo non riuscito/);assert.doesNotMatch(html,/<script>|<img onerror/);
});
test('unavailable CSI score does not propose a fabricated 0–0',()=>{
 const d=csiFixtureDifferences({...fixture,home_score:2,away_score:1},payload);
 assert.deepEqual(d,[{label:'Risultato',current:'2–1',source:'Non disponibile'}]);
});
test('winter time uses Europe/Rome',()=>assert.deepEqual(csiFixtureDifferences({...fixture,kickoff_at:'2026-11-05T20:15:00Z'},{...payload,date:'2026-11-05'}),[]));
test('first check and in-progress state are visible before the first snapshot',()=>{
 const html=csiReviewPanel({fixture,check:{check_status:'checking'}});assert.match(html,/07:00/);assert.match(html,/Controllo in corso/);
});
