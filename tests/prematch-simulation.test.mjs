import test from 'node:test';
import assert from 'node:assert/strict';
import {simulatePrematchTimeline,renderSimulatedTimeline} from '../fresh/pre-match-simulation.js';
import {drawTimelinePoster} from '../fresh/pre-match-poster.js';
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
 assert.ok(a.events.every(e=>e.minute>=0&&e.minute<=80));
 assert.equal(a.events.filter(e=>e.type==='phase').length,3);
 assert.ok(a.events.every(e=>e.type!=='substitution'||!lineup.players.some(p=>p.player_id===e.player_id)));
 const html=renderSimulatedTimeline(a);
 assert.match(html,/SIMULAZIONE/);
 assert.match(html,/GOL/);
 assert.match(html,/Genera immagine 9:16/);
});
test('no lineup means no speculative named substitutions',()=>{
 const scenario=simulatePrematchTimeline({fixture,prediction});
 assert.equal(scenario.events.filter(e=>e.type==='substitution').length,0);
});
test('missing prediction remains explicitly unavailable',()=>{
 assert.equal(simulatePrematchTimeline({fixture}).events.length,0);
});

test('named goals carry a plausible assist or individual dynamic and retain the score',()=>{
 const prediction={probabilities:{mostLikely:{home:3,away:1}},expectedGoals:{home:2.4,away:1},coverage:60};
 const rich=simulatePrematchTimeline({fixture,prediction,lineup,players,roster:players.map(x=>({player_id:x.id,active:true})),
  stats:players.map(x=>({player_id:x.id,appearances:6,goals:0,assists:0,minutes:250})),competition:{periods:2,minutes_per_period:40}});
 const ourGoals=rich.events.filter(e=>e.type==='goal'&&e.side==='home');
 assert.equal(ourGoals.length,3);
 assert.ok(ourGoals.every(e=>e.scorer&&e.dynamics&&e.method));
 assert.ok(ourGoals.every(e=>!e.assist_id||e.assist_id!==e.player_id));
 assert.equal(rich.score,'3–1');
 assert.ok(new Set(ourGoals.map(e=>e.scorer)).size>=2,'Penalty for repeated scorers should discourage mechanical hat tricks');
});
test('late goals are attributed only to players in the field at their minute',()=>{
 const r=simulatePrematchTimeline({fixture,prediction,lineup,players,roster:players.map(x=>({player_id:x.id,active:true})),
 stats:players.map(x=>({player_id:x.id,minutes:250,appearances:6})),competition:{periods:2,minutes_per_period:40}});
 const ids=new Set(lineup.players.map(p=>p.player_id));
 for(const event of r.events){
  if(event.type==='goal'&&event.side==='home')assert.ok(ids.has(event.player_id),'A scorer must have been on the field when scoring');
  if(event.type==='substitution'){ids.delete(event.off_id);ids.add(event.player_id)}
 }
});

test('shareable poster is 1080×1920 and uses exactly the selected scenario events',()=>{
 const model=simulatePrematchTimeline({fixture,prediction,lineup,players,roster:players.map(p=>({player_id:p.id,active:true})),stats:[],competition:{periods:2,minutes_per_period:40}});
 const painted=[];
 const ctx={createLinearGradient:()=>({addColorStop(){}}),beginPath(){},roundRect(){},fill(){},stroke(){},moveTo(){},lineTo(){},arc(){},fillRect(){},measureText:s=>({width:String(s).length*13}),fillText:(text)=>painted.push(String(text))};
 const canvas={getContext:()=>ctx,width:0,height:0};
 drawTimelinePoster(canvas,model);
 assert.equal(canvas.width,1080);
 assert.equal(canvas.height,1920);
 assert.ok(painted.includes(model.score));
 assert.ok(painted.some(x=>x.includes('SIMULAZIONE GARA')));
 assert.ok(model.events.filter(e=>e.type==='goal').every(e=>painted.some(t=>t.includes(e.label)||e.label.includes(t.replace('…','')))));
});
