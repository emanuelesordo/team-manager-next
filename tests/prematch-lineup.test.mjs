import test from 'node:test';
import assert from 'node:assert/strict';
import {buildHypotheticalLineup} from '../fresh/pre-match-lineup.js';

const team={id:'team-1',name:'Caselle'};
const fixture={id:'fx-target',competition_id:'c1',status:'scheduled',kickoff_at:'2026-10-12T19:00:00Z',
 home_team_id:'team-1',home_opponent_id:null,away_team_id:null,away_opponent_id:'opp-x'};
const targetMatch={id:'m-target',fixture_id:'fx-target',competition_id:'c1',kickoff_at:fixture.kickoff_at,status:'scheduled'};
const players=Array.from({length:13},(_,i)=>({id:'p'+(i+1),first_name:'P'+(i+1),last_name:'Test'+(i+1),
 generic_role_manual:i===0?'P':i<5?'D':i<9?'C':'A'}));
const roster=players.map(p=>({player_id:p.id,active:true}));
const matches=[
 {id:'m1',fixture_id:'fx1',competition_id:'c1',kickoff_at:'2026-09-20T19:00:00Z',status:'finished',formation:'4-4-2'},
 {id:'m2',fixture_id:'fx2',competition_id:'c1',kickoff_at:'2026-09-27T19:00:00Z',status:'finished',formation:'4-4-2'},
 {id:'m3',fixture_id:'fx3',competition_id:'c1',kickoff_at:'2026-10-04T19:00:00Z',status:'finished',formation:'4-3-3'}
];
const priorSelections=[];
for(const [mi,m] of matches.entries()){
 for(let i=0;i<11;i++)priorSelections.push({match_id:m.id,player_id:'p'+(i+1),selection_status:'starter',started:true,tactical_slot:i+1,shirt_number:i+1});
}
const data={players,roster,matches,priorSelections,contracts:[],habitual:[],injuries:[],suspensions:[],disciplinaryEvents:[],competitionLinks:[]};
const competition={id:'c1',discipline_rules:{}};
const prediction={comparableFixtureIds:{home:['fx1','fx2'],away:[]}};

test('hypothetical XI uses comparable formations and excludes current absences',()=>{
 const matchData={players:[{player_id:'p3',selection_status:'absent',started:false,unavailability_reason:'injury'}]};
 const result=buildHypotheticalLineup({fixture,targetMatch,data,matchData,team,competition,prediction,kit:{}});
 assert.ok(result);
 assert.equal(result.formation,'4-4-2');
 assert.equal(result.comparableUsed,true);
 assert.equal(result.sampleSize,2);
 assert.equal(result.players.length,11);
 assert.equal(result.players.some(p=>p.player_id==='p3'),false);
 assert.equal(result.availableCount,12);
});

test('hypothetical XI falls back to recent lineups when comparable sample is absent',()=>{
 const result=buildHypotheticalLineup({fixture,targetMatch,data,matchData:{players:[]},team,competition,prediction:{comparableFixtureIds:{home:[],away:[]}},kit:{}});
 assert.ok(result);
 assert.equal(result.comparableUsed,false);
 assert.ok(result.sampleSize>=1);
 assert.equal(result.players.length,11);
});
