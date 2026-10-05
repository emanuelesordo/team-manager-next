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
test('input voto testuale: vuoto SV, separatori flessibili, compatto e arrotondamento a mezzi punti',()=>{
 assert.equal(parseVote(''),null);
 assert.equal(parseVote(undefined),null);
 assert.equal(parseVote('SV'),null);
 assert.equal(parseVote('6,5'),6.5);
 assert.equal(parseVote('6.5'),6.5);
 assert.equal(parseVote('65'),6.5);
 assert.equal(parseVote('6,3'),6.5);
 assert.equal(parseVote('6,2'),6);
 assert.equal(parseVote('10'),10);
 for(const bad of ['0','10.5','nan'])assert.throws(()=>parseVote(bad));
});

test('public match panel uses aggregate ratings without leaking voters',async()=>{
 globalThis.localStorage={getItem(){return null},setItem(){},removeItem(){}};
 const {votesPanel}=await import('../fresh/votes.js');
 const html=votesPanel({
  match:{status:'finished'},data:{players:[{player_id:'a',started:true}],events:[],ratings:[],
  ratingMeans:[{player_id:'a',votes:4,sv:1,avg_rating:8.25}]},
  people:[{id:'a',first_name:'Marco',last_name:'Prova'}],
  userId:null,loggedIn:false,escape:x=>String(x)
 });
 assert.match(html,/8,25/);assert.match(html,/4 voti/);assert.match(html,/1 SV/);
 assert.doesNotMatch(html,/voter_id/);
});
