import test from 'node:test';import assert from 'node:assert/strict';
import{projectLeague,projectionSignature}from'../fresh/projection.js';
const cid='competition',competition={id:cid,kind:'league',win_points:3,draw_points:1,loss_points:0};
const data=[
 {id:'1',competition_id:cid,status:'finished',kickoff_at:'2026-09-09T18:00:00Z',home_team:'A',away_team:'B',home_team_id:null,home_opponent_id:'A',away_team_id:null,away_opponent_id:'B',home_score:0,away_score:0},
 {id:'2',competition_id:cid,status:'scheduled',kickoff_at:'2026-10-07T18:00:00Z',home_team:'B',away_team:'A',home_team_id:null,home_opponent_id:'B',away_team_id:null,away_opponent_id:'A',home_score:null,away_score:null}
];
const table=[{competition_id:cid,team:'A',team_id:null,opponent_id:'A',points:1,played:1},{competition_id:cid,team:'B',team_id:null,opponent_id:'B',points:1,played:1}];
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

test('changing labels does not alter the identity or simulation seed',()=>{
 const newLabels=data.map(x=>({...x,home_team:x.home_team+' renamed',away_team:x.away_team+' renamed'}));
 const renamedStandings=table.map(x=>({...x,team:x.team+' renamed'}));
 assert.equal(projectionSignature(competition,newLabels,renamedStandings),projectionSignature(competition,data,table));
 const original=projectLeague(competition,data,table,100),updated=projectLeague(competition,newLabels,renamedStandings,100);
 assert.deepEqual(original.rows.map(x=>[x.club_id,x.position,x.expectedPoints]),updated.rows.map(x=>[x.club_id,x.position,x.expectedPoints]));
});


test('historical weight decays against the actual competition length',()=>{
 const mk=(id,status,home,away,hs=null,as=null)=>({
  id:String(id),competition_id:cid,status,kickoff_at:'2026-10-'+String(id).padStart(2,'0')+'T18:00:00Z',
  home_team:home,away_team:away,home_team_id:null,home_opponent_id:home,
  away_team_id:null,away_opponent_id:away,home_score:hs,away_score:as
 });
 const history=[
  {opponent_id:'A',season_start_year:2025,tier_level:2,final_position:2,total_positions:14,points:42,max_points:54,goal_difference:20},
  {opponent_id:'B',season_start_year:2025,tier_level:3,final_position:12,total_positions:14,points:14,max_points:54,goal_difference:-25}
 ];
 const fixtures=Array.from({length:12},(_,i)=>mk(i+1,i<6?'finished':'scheduled',i%2?'A':'B',i%2?'B':'A',i<6?(i%3):null,i<6?((i+1)%3):null));
 const standings=[
  {competition_id:cid,team:'A',opponent_id:'A',points:9,played:6},
  {competition_id:cid,team:'B',opponent_id:'B',points:9,played:6}
 ];
 const half=projectLeague(competition,fixtures,standings,100,history);
 for(const row of half.rows){
  assert.equal(row.gamesCompleted,6);
  assert.equal(row.totalCompetitionGames,12);
  assert.ok(Math.abs(row.historicalWeight-(6/(6+2.5*6)))<1e-9);
 }
 const earlyFixtures=fixtures.map((f,i)=>i<2?f:{...f,status:'scheduled',home_score:null,away_score:null});
 const earlyStandings=standings.map(x=>({...x,played:2,points:3}));
 const early=projectLeague(competition,earlyFixtures,earlyStandings,100,history);
 assert.ok(early.rows.every(x=>x.historicalWeight>.6&&x.historicalWeight<.7));
});
