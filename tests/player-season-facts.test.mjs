import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcilePlayerSeasonFacts} from '../fresh/player-season-facts.js';
import {weightedTeamRating} from '../fresh/team-rating.js';
import {matchPlayerIntervals} from '../fresh/player-participation.js';
import {renderPlayerIntelligence} from '../fresh/player-intelligence.js';

const c={id:'c',minutes_per_period:40,periods:2};
const match=id=>({id,fixture_id:'f'+id,competition_id:'c',status:'finished',home_away:'home'});
const sub=(id,minute,payload={},stoppage_minute=0)=>({match_id:id,event_type:'substitution',player_id:'out',secondary_player_id:'p',team_side:'team',
 minute,payload,stoppage_minute,validation_status:'official'});
const end=(id,period,recovery_actual,recovery_minutes=recovery_actual)=>({
 match_id:id,event_type:'period_end',team_side:'team',payload:{period,recovery_actual,recovery_minutes},validation_status:'official'
});
const matches=[match('a'),match('b'),match('d')];
const selections=matches.flatMap(m=>[{match_id:m.id,player_id:'out',started:true,selection_status:'starter'},
 {match_id:m.id,player_id:'p',started:false,selection_status:'bench'}]);
const events=[
 sub('a',34,{period:'second_half'}),end('a','first_half',2),end('a','second_half',7),
 sub('b',80,{period:'second_half',entered_from:'tm_app_live'},1),end('b','first_half',3,2),end('b','second_half',5,4),
 sub('d',51,{period:'second_half',entered_from:'tm_app_live'}),end('d','first_half',6),end('d','second_half',4)
];
const playerStats=[{player_id:'p',appearances:3,starts:0,minutes:0,goals:1,assists:0,avg_rating:6.42},
 {player_id:'out',appearances:3,starts:3,minutes:0,goals:0,assists:0},
 {player_id:'unused',appearances:0,starts:0,minutes:0,goals:0,assists:0}];
const opts={playerStats,matches,matchPlayers:selections,events,competitions:[c]};

test('single seasonal producer uses SQL totals and verified 50-minute player presence',()=>{
 const r=reconcilePlayerSeasonFacts(opts);
 const p=r.stats.find(x=>x.player_id==='p');
 assert.equal(p.appearances,3);
 assert.equal(p.starts,0);
 assert.equal(p.subentries,3);
 assert.equal(p.minutes,50);
 assert.equal(p.goals,1);
 assert.equal(p.avg_rating,6.42);
 assert.equal(p.minutesCoverage,'complete');
 assert.deepEqual(r.derivedByPlayer.get('p').perMatch.map(x=>x.minutes),[13,4,33]);
 assert.equal(r.stats.find(x=>x.player_id==='unused').minutes,0);
 assert.equal(r.discrepancies.length,0);
});
test('failure to load event data never changes missing minutes into zeros',()=>{
 const r=reconcilePlayerSeasonFacts({...opts,events:[],eventsLoaded:false});
 const p=r.stats.find(x=>x.player_id==='p');
 assert.equal(p.minutes,null);
 assert.equal(p.subentries,null);
 assert.equal(p.appearances,3);
});
test('an incomplete season does not report a partial minute sum as final',()=>{
 const r=reconcilePlayerSeasonFacts({...opts,events:events.filter(e=>e.match_id!=='d'),matches});
 const p=r.stats.find(x=>x.player_id==='p');
 assert.equal(p.minutes,null);
 assert.equal(p.subentries,null);
 assert.ok(r.discrepancies.length>0);
});
test('a disagreement with the official number of appearances is reported, not silently overwritten',()=>{
 const changed=playerStats.map(s=>s.player_id==='p'?{...s,appearances:2}:s);
 const r=reconcilePlayerSeasonFacts({...opts,playerStats:changed});
 assert.equal(r.stats.find(s=>s.player_id==='p').appearances,2);
 assert.equal(r.stats.find(s=>s.player_id==='p').minutes,null);
 assert.equal(r.stats.find(s=>s.player_id==='p').subentries,null);
 assert.equal(r.discrepancies.some(x=>x.player_id==='p'&&x.kind==='appearances'),true);
});
test('the player card does not use a local reconstructed estimate when the final aggregate is explicitly unavailable',()=>{
 const fixture={id:'fa',status:'finished',home_team_id:'team',away_team_id:'opp',home_score:0,away_score:0,competition_id:'c',kickoff_at:'2026-10-01T20:00:00Z'};
 const s={fixtures:[fixture],matches:[match('a')],matchPlayers:selections.filter(x=>x.match_id==='a'),events:events.filter(e=>e.match_id==='a'),competitions:[c],team:{id:'team'},
 stats:{player_id:'p',appearances:1,starts:0,subentries:1,minutes:null}};
 const html=renderPlayerIntelligence('p',s);
 assert.match(html,/Minuti giocati<\/span><strong>—/);
 assert.match(html,/Minuti non verificabili/);
});
test('team rating is weighted with the same complete shared intervals, not manually interpreted timestamps',()=>{
 const rows=[{match_id:'a',player_id:'out',started:true},{match_id:'a',player_id:'p',started:false}];
 const m=match('a'),es=events.filter(e=>e.match_id==='a');
 const timeline=matchPlayerIntervals(m,rows,es,c);
 assert.equal(timeline.players.get('p').minutes,13);
 assert.equal(timeline.players.get('out').minutes,76);
 const rating=weightedTeamRating({match:m,matchPlayers:rows,events:es,ratings:[{player_id:'p',rating:8},{player_id:'out',rating:6}],competition:c});
 assert.ok(Math.abs(rating-(13*8+76*6)/89)<1e-9);
 assert.equal(weightedTeamRating({match:m,matchPlayers:rows,events:[...es,{match_id:'a',event_type:'substitution',minute:null,team_side:'team',validation_status:'official'}],
  ratings:[{player_id:'p',rating:8}],competition:c}),null);
});
test('temporary blue-card interval excludes the suspension minutes but keeps subsequent play',()=>{
 const m=match('a'),rows=[{player_id:'p',match_id:'a',started:true}];
 const es=[...events.filter(e=>e.match_id==='a'&&e.event_type==='period_end'),
 {match_id:'a',event_type:'blue_card',minute:10,team_side:'team',player_id:'p',validation_status:'official',payload:{period:'first_half'}},
 {match_id:'a',event_type:'blue_return',minute:20,team_side:'team',player_id:'p',validation_status:'official',payload:{period:'first_half'}}];
 const result=matchPlayerIntervals(m,rows,es,c).players.get('p');
 assert.deepEqual(result.intervals,[[0,10],[20,89]]);
 assert.equal(result.minutes,79);
});

test('server-calculated final totals override local reconciliation with an audit discrepancy',()=>{
 const fromServer=playerStats.map(row=>row.player_id==='p'?{...row,minutes:49,subentries:3,minutes_coverage:'complete'}:row);
 const result=reconcilePlayerSeasonFacts({...opts,playerStats:fromServer});
 const p=result.stats.find(x=>x.player_id==='p');
 assert.equal(p.minutes,49);assert.equal(p.subentries,3);assert.equal(p.minutesCoverage,'complete');
 assert.equal(result.derivedByPlayer.get('p').source,'app_player_season_stats');
 assert.ok(result.discrepancies.some(x=>x.kind==='sql_frontend_mismatch'&&x.sql_minutes===49&&x.local_minutes===50));
});
test('server facts remain available even if a client-side events request fails',()=>{
 const fromServer=playerStats.map(row=>row.player_id==='p'?{...row,minutes:50,subentries:3,minutes_coverage:'complete'}:row);
 const result=reconcilePlayerSeasonFacts({...opts,playerStats:fromServer,events:[],eventsLoaded:false});
 const p=result.stats.find(x=>x.player_id==='p');
 assert.equal(p.minutes,50);assert.equal(p.subentries,3);
 assert.equal(p.minutesCoverage,'complete');
});
test('server unavailable is never replaced by a partially reconstructed local value',()=>{
 const fromServer=playerStats.map(row=>row.player_id==='p'?{...row,minutes:null,subentries:null,minutes_coverage:'unavailable'}:row);
 const result=reconcilePlayerSeasonFacts({...opts,playerStats:fromServer});
 const p=result.stats.find(x=>x.player_id==='p');
 assert.equal(p.minutes,null);assert.equal(p.subentries,null);assert.equal(p.minutesCoverage,'unavailable');
});
