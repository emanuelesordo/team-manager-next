import test from 'node:test';
import assert from 'node:assert/strict';
import {buildHypotheticalLineup,renderHypotheticalLineup,roleFitForSlot,positionalAdjustment,recentOpponentForm} from '../fresh/pre-match-lineup.js';

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

test('model fallback rating is never displayed as a factual player average',()=>{
 const unobserved={...data,
  playerStats:data.playerStats.map(r=>r.player_id==='p1'?{...r,avg_rating:null}:r),
  seasonRatings:data.seasonRatings.filter(r=>r.player_id!=='p1')};
 const model=buildHypotheticalLineup({fixture,targetMatch,data:unobserved,matchData:{players:[]},
  team,competition,competitions:[competition],prediction,kit:{},events:[]});
 const keeper=model.players.find(p=>p.player_id==='p1');
 assert.ok(keeper);
 assert.equal(keeper.meanRating,null);
 assert.ok(Number.isFinite(keeper.expectedRating));
 const html=renderHypotheticalLineup(model);
 assert.match(html,/prematch-player-rating/);
});

test('saved specific affinities constrain a player to the appropriate field zone',()=>{
 const modified={...data,rolePositions:[
 {id:'position-p',code:'POR',category:'goalkeeper'},
 {id:'position-d',code:'TD',category:'defender'},
 {id:'position-a',code:'ATT',category:'forward'}
 ],roleAffinities:[
 {player_id:'p1',position_id:'position-p',affinity_pct:100,is_natural:true},
 {player_id:'p2',position_id:'position-d',affinity_pct:100,is_natural:true},
 {player_id:'p2',position_id:'position-a',affinity_pct:0,is_natural:false}
 ]};
 const defender=roleFitForSlot('p2',{x:80,y:68},'D',modified);
 const striker=roleFitForSlot('p2',{x:50,y:16},'A',modified);
 assert.ok(defender.fit>.5);
 assert.equal(defender.roleCode,'TD');
 assert.equal(striker.fit,0);
 assert.equal(roleFitForSlot('p3',{x:80,y:68},'D',modified),null);
 const result=buildHypotheticalLineup({fixture,targetMatch,data:modified,matchData:{players:[]},team,competition,competitions:[competition],prediction,kit:{},events:[]});
 assert.ok(result.players.some(x=>x.player_id==='p2'));
 assert.equal(result.players.find(x=>x.player_id==='p2').role,'TD');
});

test('nine proposals in a 3x3 matrix have valid feasible lineups and navigation',()=>{
 const model=buildHypotheticalLineup({fixture,targetMatch,data,matchData:{players:[{player_id:'p3',selection_status:'absent',unavailability_reason:'injury'}]},team,competition,competitions:[competition],prediction,kit:{},events:[]});
 assert.equal(model.proposals.length,9);
 assert.equal(model.formation,model.proposals[0].formation);
 assert.equal(new Set(model.proposals.map(p=>p.formation)).size,3);
 for(let group=0;group<3;group++){
  assert.equal(new Set(model.proposals.slice(group*3,group*3+3).map(p=>p.formation)).size,1);
  assert.deepEqual(model.proposals.slice(group*3,group*3+3).map(p=>p.variantIndex),[1,2,3]);
 }
 for(const proposal of model.proposals){
  assert.equal(new Set(proposal.players.map(p=>p.player_id)).size,proposal.players.length);
  assert.ok(proposal.players.every(p=>p.player_id!=='p3'));
  assert.equal(proposal.players.length,11);
  assert.ok(Number.isInteger(proposal.feasibility)&&proposal.feasibility>=0&&proposal.feasibility<=100);
 }
 const html=renderHypotheticalLineup(model);
 assert.equal((html.match(/class="prematch-lineup-slide"/g)||[]).length,9);
 assert.match(html,/data-prematch-module="3"/);
 assert.match(html,/data-prematch-variant="3"/);
 assert.match(html,/fattibilità/);
 assert.match(html,/data-prematch-slide-step="1"/);
 assert.match(html,/data-prematch-lineup-carousel/);
 assert.ok(model.proposals[0].tacticalScore>=model.proposals[3].tacticalScore);
 assert.ok(model.proposals[3].tacticalScore>=model.proposals[6].tacticalScore);
});
test('missing eligible players reduce completeness without inventing a full XI',()=>{
 const fewer={...data,roster:data.roster.slice(0,8)};
 const model=buildHypotheticalLineup({fixture,targetMatch,data:fewer,matchData:{players:[]},team,competition,competitions:[competition],prediction,kit:{},events:[]});
 assert.equal(model.proposals.length,9);
 assert.ok(model.proposals.every(p=>p.players.length<=8));
 assert.ok(model.proposals.every(p=>p.availableCount===8));
});

test('outside natural zone lowers projected fit, without altering historical mean',()=>{
 const configured={...data,rolePositions:[{id:'a',code:'TD',category:'defender'},{id:'b',code:'DC',category:'defender'}],
 roleAffinities:[{player_id:'p2',position_id:'a',affinity_pct:100,is_natural:true},{player_id:'p2',position_id:'b',affinity_pct:60,is_natural:false}]};
 const natural=positionalAdjustment('p2',{x:86,y:70},'D',configured);
 const moved=positionalAdjustment('p2',{x:50,y:74},'D',configured);
 assert.ok(natural.ratingPenalty<moved.ratingPenalty);
 assert.ok(natural.movement<moved.movement);
 assert.equal(positionalAdjustment('p3',{x:50,y:74},'D',configured).ratingPenalty,0);
});
test('recent form weighs opponent relevance and excludes future matches',()=>{
 const ratings=[
 {match_id:'m1',player_id:'p2',rating:8},
 {match_id:'m2',player_id:'p2',rating:5},
 {match_id:'m3',player_id:'p2',rating:7},
 {match_id:'m-target',player_id:'p2',rating:10}
 ];
 const recent={...data,seasonRatings:ratings};
 const high=recentOpponentForm('p2',recent,matches,{fx1:1,fx2:.35,fx3:.35},6);
 const low=recentOpponentForm('p2',recent,matches,{fx1:.35,fx2:1,fx3:.35},6);
 assert.ok(high.delta>low.delta);
 assert.equal(high.samples,3);
 assert.equal(recentOpponentForm('p2',recent,[],{},6).samples,0);
});

test('global lineup simulation remains responsive with a full 28-player squad',()=>{
 const fullPlayers=Array.from({length:28},(_,i)=>({...players[i%players.length],id:'stress-'+i,first_name:'Test',last_name:'Stress'+i}));
 const stress={...data,players:fullPlayers,roster:fullPlayers.map(p=>({player_id:p.id,active:true})),
  priorSelections:[],seasonRatings:[],playerStats:[],roleAffinities:[]};
 const start=performance.now();
 const model=buildHypotheticalLineup({fixture,targetMatch,data:stress,matchData:{players:[]},
  team,competition,competitions:[competition],prediction,kit:{},events:[]});
 assert.equal(model.proposals.length,9);
 assert.equal(model.players.length,11);
 assert.ok(performance.now()-start<5000,'Global lineup must finish in under 5 seconds in CI');
});
