import test from 'node:test';import assert from 'node:assert/strict';
globalThis.localStorage={getItem(){return null},setItem(){},removeItem(){}};
const {renderPlayerTrend,playerTrendPanel}=await import('../fresh/player-trend.js');
test('recent votes never expose voter_id',()=>{
 const html=renderPlayerTrend([{opponent:'Opponent',avg_rating:7.5,votes:4,sv:1,kickoff_at:'2026-09-22T10:00:00Z',voter_id:'secret'}]);
 assert.match(html,/7,50/);assert.match(html,/Opponent/);assert.doesNotMatch(html,/secret|voter_id/);
});
test('all null votes render SV rather than zero',()=>{
 assert.match(renderPlayerTrend([{opponent:'A',avg_rating:null,votes:0,sv:1}]),/SV/);
 assert.match(playerTrendPanel({id:'abc'}),/player-trend/);
});
