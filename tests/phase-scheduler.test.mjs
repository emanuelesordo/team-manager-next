import test from 'node:test';
import assert from 'node:assert/strict';
import {clubKey,roundRobinDraft} from '../fresh/phase-scheduler.js';

function prepared(d,e){
 const participants=Array.from({length:d+e},(_,i)=>({
  team_id:null,opponent_id:'club-'+i,
  source_competition_id:i<d?'D':'E',
  source_rank:i<d?i+1:i-d+1
 }));
 const old=[];
 for(const [from,to,source] of [[0,d,'D'],[d,d+e,'E']]){
  for(let i=from;i<to;i++)for(let j=i+1;j<to;j++){
   old.push({id:source+'-'+i+'-'+j,competition_id:source,
    home_team_id:null,home_opponent_id:'club-'+i,
    away_team_id:null,away_opponent_id:'club-'+j,
    status:'finished',home_score:3,away_score:2});
  }
 }
 return {participants,old};
}
function checkLeague(d,e,expectedGames,expectedReversed,expectedRounds){
 const {participants,old}=prepared(d,e);
 const rows=roundRobinDraft(participants,old,['D','E']);
 assert.equal(rows.length,expectedGames);
 assert.equal(new Set(rows.map(x=>x.round_no)).size,expectedRounds);
 assert.equal(rows.filter(x=>x.previous_fixture_id).length,expectedReversed);
 const matchup=new Set(),appearances=new Map();
 for(const row of rows){
  const a=row.home_opponent_id,b=row.away_opponent_id;
  assert.ok(a!==b);
  const key=[a,b].sort().join(':');
  assert.ok(!matchup.has(key),'Duplicate pair: '+key);
  matchup.add(key);
  appearances.set(a,(appearances.get(a)||0)+1);
  appearances.set(b,(appearances.get(b)||0)+1);
  assert.equal(row.kickoff_at,null);
  assert.equal(row.status,'draft');
  assert.equal('home_score' in row,false);
  assert.equal('away_score' in row,false);
  if(row.previous_fixture_id){
   const prior=old.find(x=>x.id===row.previous_fixture_id);
   assert.ok(prior);
   assert.equal(a,prior.away_opponent_id,'Prior venue must be reversed');
   assert.equal(b,prior.home_opponent_id,'Prior venue must be reversed');
  }
 }
 assert.equal(appearances.size,d+e);
 assert.ok([...appearances.values()].every(n=>n===d+e-1));
 return rows;
}
test('Serie B playoffs: five D + five E, 45 fresh games, nine per team and reverse existing venues',()=>{
 const rows=checkLeague(5,5,45,20,9);
 assert.ok(rows.every(row=>row.round_no>=1&&row.round_no<=9));
});
test('Torneo Primavera: eight D + seven E, 105 fresh games and one bye per round',()=>{
 const rows=checkLeague(8,7,105,49,15);
 for(let round=1;round<=15;round++)assert.equal(rows.filter(x=>x.round_no===round).length,7);
});
test('each club identity comes exclusively from its ID',()=>{
 assert.equal(clubKey({team_id:'main',opponent_id:null}),'team:main');
 assert.equal(clubKey({team_id:null,opponent_id:'guest'}),'opponent:guest');
 assert.throws(()=>clubKey({team_id:null,opponent_id:null}));
 assert.throws(()=>clubKey({team_id:'main',opponent_id:'guest'}));
});
test('ambiguous original fixture identity refuses to guess a venue',()=>{
 const {participants,old}=prepared(5,5);
 assert.throws(()=>roundRobinDraft(participants,[...old,old[0]],['D','E']),/Ambiguous/);
});
