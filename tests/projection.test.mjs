import test from 'node:test';import assert from 'node:assert/strict';
import{projectLeague,projectionSignature}from'../fresh/projection.js';
const cid='competition',competition={id:cid,kind:'league',win_points:3,draw_points:1,loss_points:0};
const data=[
 {id:'1',competition_id:cid,status:'finished',kickoff_at:'2026-09-09T18:00:00Z',home_team:'A',away_team:'B',home_score:0,away_score:0},
 {id:'2',competition_id:cid,status:'scheduled',kickoff_at:'2026-10-07T18:00:00Z',home_team:'B',away_team:'A',home_score:null,away_score:null}
];
const table=[{competition_id:cid,team:'A',points:1,played:1},{competition_id:cid,team:'B',points:1,played:1}];
test('10k simulations deterministic, no input mutation',()=>{
 const copy=structuredClone([data,table]);
 const a=projectLeague(competition,data,table);
 const b=projectLeague(competition,structuredClone(data),structuredClone(table));
 assert.deepEqual(a,b);assert.deepEqual([data,table],copy);
 assert.equal(a.iterations,10000);assert.equal(a.remaining,1);assert.equal(a.rows.length,2);
 for(const x of a.rows)assert.ok(x.expectedPoints>=1&&x.position>=1&&x.position<=2);
});
test('fixture status/results or rules modify signature',()=>{
 const k=projectionSignature(competition,data,table);
 assert.notEqual(k,projectionSignature(competition,[{...data[0],home_score:2},data[1]],table));
 assert.notEqual(k,projectionSignature({...competition,win_points:2},data,table));
});
test('tournament without standings and finished season do not predict',()=>{
 assert.equal(projectLeague(competition,data,[],10),null);
 const r=projectLeague(competition,data.map(x=>({...x,status:'finished',home_score:1,away_score:0})),table,10);
 assert.equal(r.complete,true);
});
test('custom competition points reflected and zero scores counted',()=>{
 const alt={...competition,win_points:5,draw_points:2,loss_points:1};
 const rows=[{...data[0],home_score:0,away_score:0},data[1]];
 const standings=[{...table[0],points:2},{...table[1],points:2}];
 const r=projectLeague(alt,rows,standings,100);
 for(const x of r.rows)assert.ok(x.expectedPoints>=3);
});
