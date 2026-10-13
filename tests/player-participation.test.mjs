import test from 'node:test';
import assert from 'node:assert/strict';
import {matchTiming,matchElapsedMinute,matchPlayerIntervals} from '../fresh/player-participation.js';
import {aggregatePlayerMinutes} from '../fresh/analytics.js';
import {playerIntelligence} from '../fresh/player-intelligence.js';

const competition={id:'c1',minutes_per_period:40,periods:2};
const periodEnd=(match_id,period,announced,actual)=>({
 match_id,event_type:'period_end',minute:period==='first_half'?40:80,
 validation_status:'official',team_side:'team',
 payload:{period,recovery_minutes:announced,...(actual==null?{}:{recovery_actual:actual})}
});
const finish=(id,score=0)=>({
 id,status:'finished',competition_id:'c1',home_away:'home',fixture_id:'f'+id,
 kickoff_at:'2026-10-05T20:00:00Z',home_score:score,away_score:0
});
const entry=(id,minute,payload={},stoppage_minute=0)=>({
 match_id:id,event_type:'substitution',minute,stoppage_minute,
 validation_status:'official',team_side:'team',player_id:'out'+id,
 secondary_player_id:'p',payload
});
const players=id=>[
 {match_id:id,player_id:'out'+id,started:true},
 {match_id:id,player_id:'p',started:false,selection_status:'bench'}
];
test('34th minute of second half is football 74 but physical elapsed 76 after 2 recovery',()=>{
 const m=finish('a'),ends=[periodEnd('a','first_half',2),periodEnd('a','second_half',7)];
 const e=entry('a',34,{period:'second_half'});
 const timing=matchTiming(m,competition,ends);
 assert.equal(timing.duration,89);
 assert.equal(matchElapsedMinute(e,competition,timing),76);
 const r=matchPlayerIntervals(m,players('a'),[e,...ends],competition).players.get('p');
 assert.equal(r.valid,true);assert.equal(r.minutes,13);
 assert.deepEqual(r.intervals,[[76,89]]);
});
test('effective stoppage supersedes announced, minute 80+1 is four minutes in 80+5 match',()=>{
 const m=finish('b'),ends=[periodEnd('b','first_half',2,3),periodEnd('b','second_half',4,5)];
 const e=entry('b',80,{period:'second_half',entered_from:'tm_app_live'},1);
 const timing=matchTiming(m,competition,ends);
 assert.equal(timing.duration,88);
 assert.equal(matchElapsedMinute(e,competition,timing),84);
 assert.equal(matchPlayerIntervals(m,players('b'),[...ends,e],competition).players.get('p').minutes,4);
});
test('a cumulative live event at 51 has no extra 40 and uses first-half recovery of 6',()=>{
 const m=finish('c'),ends=[periodEnd('c','first_half',6,6),periodEnd('c','second_half',4,4)];
 const e=entry('c',51,{period:'second_half',entered_from:'tm_app_live'});
 const timing=matchTiming(m,competition,ends);
 assert.equal(matchElapsedMinute(e,competition,timing),57);
 assert.equal(matchPlayerIntervals(m,players('c'),[e,...ends],competition).players.get('p').minutes,33);
});
test('Rosa and scheda player use identical three-match participation and 50 minutes',()=>{
 const matches=[finish('a'),finish('b'),finish('c')];
 const ends=[periodEnd('a','first_half',2),periodEnd('a','second_half',7),
  periodEnd('b','first_half',2,3),periodEnd('b','second_half',4,5),
  periodEnd('c','first_half',6,6),periodEnd('c','second_half',4,4)];
 const events=[entry('a',34,{period:'second_half'}),
  entry('b',80,{period:'second_half',entered_from:'tm_app_live'},1),
  entry('c',51,{period:'second_half',entered_from:'tm_app_live'}),...ends];
 const matchPlayers=matches.flatMap(m=>players(m.id));
 const mins=aggregatePlayerMinutes(matches,matchPlayers,events,[competition]);
 assert.equal(mins.get('p'),50);
 const fixtures=matches.map(m=>({id:m.fixture_id,competition_id:'c1',status:'finished',home_team_id:'team',away_team_id:'opp',home_score:0,away_score:0,kickoff_at:m.kickoff_at}));
 const result=playerIntelligence('p',{fixtures,matches,matchPlayers,events,competitions:[competition],team:{id:'team'}});
 assert.equal(result.games,3);assert.equal(result.starts,0);assert.equal(result.bench,3);
 assert.equal(result.minutes,50);assert.equal(result.minutesKnown,3);
 assert.deepEqual(result.matches.map(g=>g.minutes),[13,4,33]);
});
test('incomplete team substitution, rejected events and impossible timestamps never create imaginary minutes',()=>{
 const m=finish('x'),base=[periodEnd('x','first_half',0),periodEnd('x','second_half',0)];
 const unknown={match_id:'x',event_type:'substitution',minute:52,validation_status:'official',team_side:'team',player_id:null,secondary_player_id:null};
 assert.equal(matchPlayerIntervals(m,players('x'),[...base,unknown],competition).players.get('p').minutes,null);
 const rejected={...entry('x',30,{period:'second_half'}),validation_status:'rejected'};
 assert.equal(matchPlayerIntervals(m,players('x'),[...base,rejected],competition).players.get('p').entered,false);
 assert.equal(matchElapsedMinute(entry('x',150,{period:'second_half',entered_from:'tm_app_live'}),competition,matchTiming(m,competition,base)),null);
});
test('opponent substitutions without IDs do not invalidate team player intervals',()=>{
 const m=finish('y');
 const events=[entry('y',40,{period:'halftime'}),periodEnd('y','first_half',3),periodEnd('y','second_half',2),
 {match_id:'y',event_type:'substitution',minute:56,validation_status:'official',team_side:'opponent',player_id:null,secondary_player_id:null}];
 assert.equal(matchPlayerIntervals(m,players('y'),events,competition).players.get('p').minutes,42);
});
