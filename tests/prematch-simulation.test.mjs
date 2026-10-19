import test from 'node:test';
import assert from 'node:assert/strict';
import {simulatePrematchTimeline,renderSimulatedTimeline} from '../fresh/pre-match-simulation.js';
const fixture={id:'scenario-1',home_team_id:'team',away_team_id:'other'};
const prediction={probabilities:{mostLikely:{home:2,away:1}},expectedGoals:{home:1.7,away:.9},coverage:52,
 situational:{home:{strongestFor:{label:'21–40'}},away:{strongestFor:{label:'41–60'}}}};
const players=Array.from({length:14},(_,i)=>({id:'p'+i,player_id:'p'+i,first_name:'P'+i,last_name:'Test',generic_role_manual:i<2?'P':i<7?'D':i<10?'C':'A'}));
const lineup={teamSide:'home',teamId:'team',formation:'4-4-2',players:players.slice(0,11).map((p,i)=>({player_id:p.id,slot:i+1,name:p.first_name+' Test',expectedRating:6.5,targetRole:p.generic_role_manual}))};
test('scenario is reproducible and non-persistent',()=>{
 const args={fixture,prediction,lineup,roster:players.map(p=>({player_id:p.id,active:true})),players,stats:players.map(p=>({player_id:p.id,minutes:80})),competition:{periods:2,minutes_per_period:40}};
 const a=simulatePrematchTimeline(args),b=simulatePrematchTimeline(args);
 assert.deepEqual(a,b);
 assert.equal(a.duration,80);
 assert.equal(a.events.filter(e=>e.type==='goal').length,3);
 assert.ok(a.events.every(e=>e.minute>=1&&e.minute<=80));
 assert.ok(a.events.every(e=>e.type!=='substitution'||!lineup.players.some(p=>p.player_id===e.player_id)));
 const html=renderSimulatedTimeline(a);
 assert.match(html,/SIMULAZIONE/);
 assert.match(html,/Gol ipotetico/);
});
test('no lineup means no speculative named substitutions',()=>{
 const scenario=simulatePrematchTimeline({fixture,prediction});
 assert.equal(scenario.events.filter(e=>e.type==='substitution').length,0);
});
test('missing prediction remains explicitly unavailable',()=>{
 assert.equal(simulatePrematchTimeline({fixture}).events.length,0);
});
