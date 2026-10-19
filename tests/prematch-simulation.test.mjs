import test from 'node:test';
import assert from 'node:assert/strict';
import {simulatePrematchTimeline,renderSimulatedTimeline,historicalGoalPatterns,chooseGoalMinutes,timelinePresentationEvents} from '../fresh/pre-match-simulation.js';
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
 const ctx={createLinearGradient:()=>({addColorStop(){}}),beginPath(){},roundRect(){},fill(){},stroke(){},moveTo(){},lineTo(){},arc(){},fillRect(){},save(){},restore(){},translate(){},scale(){},closePath(){},measureText:s=>({width:String(s).length*13}),fillText:(text)=>painted.push(String(text))};
 const canvas={getContext:()=>ctx,width:0,height:0};
 drawTimelinePoster(canvas,model);
 assert.equal(canvas.width,1080);
 assert.equal(canvas.height,1920);
 assert.ok(painted.includes(model.score));
 assert.ok(painted.some(x=>x.includes('SIMULAZIONE GARA')));
 assert.ok(model.events.filter(e=>e.type==='goal').every(e=>painted.some(t=>t.includes(e.label)||e.label.includes(t.replace('…','')))));
});

test('for/against distributions use strictly historical and relevant team goals',()=>{
 const now={...fixture,kickoff_at:'2026-10-20T21:00:00'};
 const fixtures=[
 {id:'old1',home_team_id:'team',away_team_id:'other',status:'finished',kickoff_at:'2026-10-10T21:00:00'},
 {id:'old2',home_team_id:'third',away_team_id:'other',status:'finished',kickoff_at:'2026-10-12T21:00:00'},
 {id:'future',home_team_id:'team',away_team_id:'other',status:'finished',kickoff_at:'2026-10-23T21:00:00'}];
 const history=[
 {id:'g1',fixture_id:'old1',event_type:'goal',team_side:'home',minute:22},
 {id:'g2',fixture_id:'old1',event_type:'goal',team_side:'away',minute:61},
 {id:'g3',fixture_id:'old2',event_type:'goal',team_side:'away',minute:24},
 {id:'g4',fixture_id:'future',event_type:'goal',team_side:'home',minute:3}
 ];
 const stats=historicalGoalPatterns({fixture:now,fixtures,events:history,duration:80});
 assert.deepEqual(stats.buckets.home.for,[22]);
 assert.deepEqual(stats.buckets.away.against,[22]);
 assert.deepEqual(stats.buckets.away.for,[61,24]);
 assert.equal(stats.sample,2);
 const minutes=chooseGoalMinutes({home:3,away:2},{fixture:now,fixtures,events:history,duration:80});
 assert.equal(minutes.length,5);
 assert.ok(minutes.every(x=>x.minute>0&&x.minute<80));
 assert.ok(minutes.every((x,i)=>i===0||x.minute>=minutes[i-1].minute));
});
test('seven maximum replacements within three in-play sessions plus interval',()=>{
 const large=Array.from({length:28},(_,i)=>({id:'x'+i,player_id:'x'+i,first_name:'Test',last_name:'Player'+i,generic_role_manual:i===0?'P':i<8?'D':i<20?'C':'A'}));
 const eleven={...lineup,players:large.slice(0,11).map((p,i)=>({player_id:p.id,slot:i+1,name:'Player'+i,targetRole:p.generic_role_manual,expectedRating:6}))};
 for(let variant=0;variant<12;variant++){
  const scenario=simulatePrematchTimeline({fixture:{...fixture,id:'sessions'+variant},prediction,lineup:eleven,players:large,roster:large.map(p=>({player_id:p.id,active:true})),stats:[],competition:{periods:2,minutes_per_period:40}});
  const changes=scenario.events.filter(e=>e.type==='substitution');
  const sessions=new Set(changes.map(e=>e.session));
  assert.ok(changes.length<=7);
  assert.ok([...sessions].filter(id=>id!=='HT').length<=3);
  assert.ok(sessions.size<=4);
  assert.ok(changes.every(e=>e.session==='HT'?e.minute===40:e.minute>40));
  assert.equal(new Set(changes.map(e=>e.player_id)).size,changes.length);
  assert.equal(new Set(changes.map(e=>e.off_id)).size,changes.length);
  assert.equal(timelinePresentationEvents(changes).length,sessions.size);
 }
});
test('historical close-goal patterns do not force repeated simultaneous goals',()=>{
 const history=Array.from({length:9},(_,i)=>({id:'h'+i,fixture_id:'old',event_type:'goal',team_side:i%2?'away':'home',minute:10+i*7}));
 const old={id:'old',home_team_id:'team',away_team_id:'other',status:'finished',kickoff_at:'2026-10-10T21:00:00'};
 const options={fixture:{...fixture,kickoff_at:'2026-10-20T21:00:00'},fixtures:[old],events:history,duration:80};
 const output=chooseGoalMinutes({home:3,away:2},options);
 assert.equal(output.length,5);
 assert.equal(new Set(output.map(x=>x.minute)).size,5);
});

test('exported poster draws every timeline minute in a dedicated visible column',()=>{
 const scenario=simulatePrematchTimeline({fixture,prediction,lineup,players,roster:players.map(x=>({player_id:x.id,active:true})),stats:[],competition:{periods:2,minutes_per_period:40}});
 const labels=[];
 const ctx={
  createLinearGradient:()=>({addColorStop(){}}),beginPath(){},roundRect(){},fill(){},stroke(){},
  moveTo(){},lineTo(){},arc(){},fillRect(){},save(){},restore(){},translate(){},scale(){},closePath(){},
  measureText:t=>({width:String(t).length*13}),
  fillText:(text,x,y)=>labels.push({text:String(text),x,y})
 };
 drawTimelinePoster({getContext:()=>ctx},scenario);
 const minutes=timelinePresentationEvents(scenario.events).map(e=>e.minute+'′');
 assert.deepEqual(labels.filter(t=>t.x===75).map(t=>t.text),minutes);
 assert.ok(labels.filter(t=>t.x===75).every(t=>t.y>467&&t.y<1735));
});
test('simulated substitutions never withdraw a previously introduced player',()=>{
 const large=Array.from({length:28},(_,i)=>({id:'z'+i,player_id:'z'+i,first_name:'Test',last_name:'Player'+i,generic_role_manual:i===0?'P':i<7?'D':i<19?'C':'A'}));
 const eleven={...lineup,players:large.slice(0,11).map((p,i)=>({player_id:p.id,slot:i+1,name:'Player'+i,targetRole:p.generic_role_manual,expectedRating:6}))};
 for(let iteration=0;iteration<60;iteration++){
  const scenario=simulatePrematchTimeline({fixture:{...fixture,id:'fresh-sub'+iteration},prediction,lineup:eleven,
   players:large,roster:large.map(p=>({player_id:p.id,active:true})),stats:[],
   competition:{periods:2,minutes_per_period:40}});
  const entered=new Set();
  for(const event of scenario.events){
   if(event.type!=='substitution')continue;
   assert.ok(!entered.has(String(event.off_id)),'A player previously subbed on must never be removed');
   entered.add(String(event.player_id));
  }
 }
});
