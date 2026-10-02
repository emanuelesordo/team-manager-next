import test from 'node:test';
import assert from 'node:assert/strict';
import {votablePlayerIds,ratingSummary,parseVote} from '../fresh/vote-domain.js';
test('panchinaro mai entrato escluso dai voti',()=>{
 const players=[{player_id:'a',started:true},{player_id:'b',started:false},{player_id:'c',started:false},{player_id:'d',started:false}];
 const ev=[{event_type:'substitution',secondary_player_id:'c',validation_status:'official'},{event_type:'substitution',secondary_player_id:'d',validation_status:'proposed'}];
 assert.deepEqual([...votablePlayerIds(players,ev)].sort(),['a','c']);
});
test('SV escluso dal rating medio ed esplicito',()=>{
 assert.deepEqual(ratingSummary([{rating:7},{rating:8.5},{rating:null}]),{average:7.75,count:2,sv:1});
 assert.deepEqual(ratingSummary([{rating:null}]),{average:null,count:0,sv:1});
});
test('valori permessi 1-10, step 0.5 e SV',()=>{
 assert.equal(parseVote('SV'),null);assert.equal(parseVote('1.5'),1.5);assert.equal(parseVote('10'),10);
 for(const bad of ['',undefined,'0','10.5','7.25','nan'])assert.throws(()=>parseVote(bad));
});
