import test from 'node:test';
import assert from 'node:assert/strict';
import {buildHypotheticalLineup,renderHypotheticalLineup} from '../fresh/pre-match-lineup.js';

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
 for(let i=0;i<11;i++)priorSelections.push({match_id:m.id,player_id:'p'+(i+1),selection_status:'starter',started:true,minutes_played:80,tactical_slot:i+1,shirt_number:i+1});
}
const fixtures=[
 {id:'fx1',competition_id:'c1',status:'finished',kickoff_at:matches[0].kickoff_at,home_team_id:'team-1',away_opponent_id:'o1',home_score:2,away_score:0},
 {id:'fx2',competition_id:'c1',status:'finished',kickoff_at:matches[1].kickoff_at,home_team_id:'team-1',away_opponent_id:'o2',home_score:1,away_score:1},
 {id:'fx3',competition_id:'c1',status:'finished',kickoff_at:matches[2].kickoff_at,home_team_id:'team-1',away_opponent_id:'o3',home_score:0,away_score:1}
];
const seasonRatings=[];
for(const m of matches)for(let i=0;i<11;i++)seasonRatings.push({match_id:m.id,player_id:'p'+(i+1),rating:6.2+i*.08});
const data={players,roster,matches,fixtures,priorSelections,seasonRatings,playerStats:players.map((p,i)=>({player_id:p.id,avg_rating:6.1+i*.08})),contracts:[],habitual:[],injuries:[],suspensions:[],disciplinaryEvents:[],competitionLinks:[]};
const competition={id:'c1',periods:2,minutes_per_period:40,discipline_rules:{}};
const prediction={comparableFixtureIds:{home:['fx1','fx2'],away:[]}};

test('hypothetical XI uses comparable formations and excludes current absences',()=>{
 const matchData={players:[{player_id:'p3',selection_status:'absent',started:false,unavailability_reason:'injury'}]};
 const result=buildHypotheticalLineup({fixture,targetMatch,data,matchData,team,competition,competitions:[competition],prediction,kit:{},events:[]});
 assert.ok(result);
 assert.equal(result.formation,'4-4-2');
 assert.equal(result.comparableUsed,true);
 assert.equal(result.sampleSize,2);
 assert.equal(result.players.length,11);
 assert.equal(result.players.some(p=>p.player_id==='p3'),false);
 assert.equal(result.availableCount,12);
 assert.ok(result.players.every(p=>Number.isFinite(p.expectedRating)));
 assert.ok(result.players.every(p=>Number.isFinite(p.meanRating)));
 assert.ok(Number.isFinite(result.xiExpectedRating));
 const html=renderHypotheticalLineup(result);
 assert.match(html,/prematch-player-rating/);
 assert.match(html,/>att</);
 assert.match(html,/>med</);
 assert.doesNotMatch(html,/prematch-player-rating[^>]*>[\s\S]*?—/);
});

test('hypothetical XI falls back to recent lineups when comparable sample is absent',()=>{
 const result=buildHypotheticalLineup({fixture,targetMatch,data,matchData:{players:[]},team,competition,competitions:[competition],prediction:{comparableFixtureIds:{home:[],away:[]},lineupFixtureWeights:{home:{},away:{}}},kit:{},events:[]});
 assert.ok(result);
 assert.equal(result.comparableUsed,false);
 assert.ok(result.sampleSize>=1);
 assert.equal(result.players.length,11);
});


test('hypothetical XI can use opponent-relevance and simultaneous co-play data',()=>{
 const events=[
  {match_id:'m1',event_type:'substitution',team_side:'team',player_id:'p11',secondary_player_id:'p12',minute:40,stoppage_minute:0,validation_status:'official',payload:{period:'second_half'},created_at:'2026-09-20T20:00:00Z'}
 ];
 const weightedPrediction={comparableFixtureIds:{home:['fx1','fx2'],away:[]},lineupFixtureWeights:{home:{fx1:1,fx2:.9,fx3:.35},away:{}}};
 const result=buildHypotheticalLineup({fixture,targetMatch,data,matchData:{players:[]},team,competition,competitions:[competition],prediction:weightedPrediction,kit:{},events});
 assert.ok(result);
 assert.equal(result.comparableUsed,true);
 assert.ok(result.players.some(p=>p.player_id==='p12')||result.players.some(p=>p.player_id==='p11'));
 assert.ok(result.confidence>0);
});


test('4-4-2 pre-match positions are symmetric and evenly spaced',()=>{
 const result=buildHypotheticalLineup({fixture,targetMatch,data,matchData:{players:[]},team,competition,competitions:[competition],prediction:{comparableFixtureIds:{home:['fx1','fx2'],away:[]},lineupFixtureWeights:{home:{fx1:1,fx2:.9},away:{}}},kit:{},events:[]});
 const keeper=result.players.find(p=>p.slot===1);
 assert.equal(keeper.x,50);
 assert.equal(keeper.y,86);
 const defenders=result.players.filter(p=>p.slot>=2&&p.slot<=5).sort((a,b)=>a.slot-b.slot);
 assert.deepEqual(defenders.map(p=>Math.round(p.x*100)/100),[15,38.33,61.67,85]);
 assert.ok(defenders.every(p=>p.y===68));
 const gaps=defenders.slice(1).map((p,i)=>p.x-defenders[i].x);
 assert.ok(Math.max(...gaps)-Math.min(...gaps)<0.001);
});
