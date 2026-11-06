import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCoachEvidence} from '../fresh/coach-ai-lineup.js';

const fixture={id:'future',kickoff_at:'2026-11-10T20:00:00Z',home_team:'Caselle',away_team:'Rivali'};
const model={availablePlayerIds:['p1'],proposals:[{rank:1,formation:'4-4-2',players:Array.from({length:11},(_,i)=>({player_id:'p'+(i+1),slot:i+1,targetRole:i===0?'P':'C'}))}]};
const players=(matchId)=>Array.from({length:12},(_,i)=>({match_id:matchId,player_id:'p'+(i+1),selection_status:i<11?'starter':'bench',started:i<11}));
const data={teamId:'caselle',fixtures:[],matches:[
 {id:'old',status:'finished',kickoff_at:'2026-10-10T20:00:00Z',formation:'4-4-2'},
 {id:'future',status:'finished',kickoff_at:'2026-11-11T20:00:00Z',formation:'3-5-2'},
 {id:'missing',status:'finished',kickoff_at:'2026-10-20T20:00:00Z',formation:'4-3-3'}
],priorSelections:[...players('old'),...players('future'),{match_id:'missing',player_id:'p1',started:true,selection_status:'starter'}]};
test('coach evidence excludes future matches and incomplete historical availability',()=>{
 const evidence=buildCoachEvidence({fixture,model,data});
 assert.deepEqual(evidence.history.map(x=>x.matchId),['old']);
 assert.equal(evidence.history[0].available.length,12);
 assert.equal(evidence.proposals.length,1);
 assert.equal(evidence.proposals[0].players.length,11);
});
test('coach evidence preserves the current availability overrides',()=>{
 const override={p1:{fitness:30,arrival:'halftime'}};
 const evidence=buildCoachEvidence({fixture,model,data,availability:override});
 assert.deepEqual(evidence.target.overrides,override);
});
