import test from 'node:test';import assert from 'node:assert/strict';
import{resultSplit,eventCoverage}from '../fresh/analytics.js';
const team={name:'Calcio Caselle',short_name:'CAS'};
const f=(home,away,hs,as,status='finished',id='f')=>({id,home_team:home,away_team:away,home_score:hs,away_score:as,status});
test('zero-zero counts as clean sheet, incomplete score ignored',()=>{
 const r=resultSplit([f('Calcio Caselle','A',0,0),f('B','Calcio Caselle',1,2,'finished','x'),f('C','Calcio Caselle',null,2,'finished','z')],team);
 assert.deepEqual([r.played,r.wins,r.draws,r.cleanSheets,r.gf,r.ga],[2,1,1,1,2,1]);
 assert.equal(r.away.played,1);
});
test('goals proposed or partial cannot trigger fabricated comeback',()=>{
 const fixture=f('Calcio Caselle','A',2,1),m={id:'m',fixture_id:'f'};
 const rows=[{match_id:'m',event_type:'goal',team_side:'team',minute:30,validation_status:'proposed'}];
 const r=eventCoverage([fixture],[m],rows,team);
 assert.equal(r.complete,0);assert.equal(r.comebacks,0);
});
test('fully verified timeline detects comeback without inferring causality',()=>{
 const fixture=f('Calcio Caselle','A',2,1),m={id:'m',fixture_id:'f'};
 const rows=[
 {match_id:'m',event_type:'goal',team_side:'opponent',minute:3,validation_status:'official',created_at:'x'},
 {match_id:'m',event_type:'goal',team_side:'team',minute:15,validation_status:'official',created_at:'y'},
 {match_id:'m',event_type:'goal',team_side:'team',minute:30,validation_status:'official',created_at:'z'}];
 const r=eventCoverage([fixture],[m],rows,team);
 assert.equal(r.complete,1);assert.equal(r.comebacks,1);assert.equal(r.comebackWins,1);
 assert.equal(r.goalSituations.behind,1);assert.equal(r.goalSituations.equal,1);
});
