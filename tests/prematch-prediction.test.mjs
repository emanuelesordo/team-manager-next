import test from 'node:test';
import assert from 'node:assert/strict';
import {predictMatch,predictionSignature} from '../fresh/pre-match-prediction.js';

const competition={id:'c1',kind:'league',win_points:3,draw_points:1,loss_points:0,periods:2,minutes_per_period:40};
const fixture=(id,status,date,home,away,hs=null,as=null,venue='Campo A')=>({
 id:String(id),competition_id:'c1',status,kickoff_at:date,home_team:home,away_team:away,
 home_team_id:null,home_opponent_id:home,away_team_id:null,away_opponent_id:away,
 home_score:hs,away_score:as,venue_name:venue
});
const fixtures=[
 fixture(1,'finished','2026-09-01T18:00:00Z','A','B',2,0,'Campo A'),
 fixture(2,'finished','2026-09-01T20:00:00Z','C','D',1,1,'Campo B'),
 fixture(3,'finished','2026-09-08T18:00:00Z','B','C',0,1,'Campo C'),
 fixture(4,'finished','2026-09-08T20:00:00Z','D','A',0,2,'Campo D'),
 fixture(5,'scheduled','2026-09-15T18:00:00Z','A','C',null,null,'Campo Sintetico'),
 fixture(6,'scheduled','2026-09-15T20:00:00Z','B','D')
];
const history=[
 {opponent_id:'A',season_start_year:2025,tier_level:2,final_position:2,total_positions:14,points:42,max_points:54,goal_difference:20},
 {opponent_id:'C',season_start_year:2025,tier_level:3,final_position:7,total_positions:14,points:26,max_points:54,goal_difference:0}
];
const venues=[
 {id:'v1',name:'Campo A',surface_type:'synthetic',width_profile:'wide',length_profile:'long'},
 {id:'v2',name:'Campo D',surface_type:'synthetic',width_profile:'wide',length_profile:'long'},
 {id:'v3',name:'Campo Sintetico',surface_type:'synthetic',width_profile:'wide',length_profile:'long'}
];

test('pre-match prediction returns normalized 1X2 probabilities and expected score',()=>{
 const result=predictMatch({fixture:fixtures[4],competition,fixtures,history,venues,matches:[],events:[],team:null,competitions:[competition]});
 assert.ok(result);
 const sum=result.probabilities.home+result.probabilities.draw+result.probabilities.away;
 assert.ok(Math.abs(sum-1)<1e-9);
 assert.ok(result.expectedGoals.home>0&&result.expectedGoals.away>0);
 assert.ok(result.coverage>=0&&result.coverage<=100);
 assert.equal(result.venue.surface_type,'synthetic');
});

test('prediction never uses results after target kickoff',()=>{
 const base=predictMatch({fixture:fixtures[4],competition,fixtures,history,venues,matches:[],events:[],team:null,competitions:[competition]});
 const changedRows=fixtures.map((f,i)=>i===5?{...f,status:'finished',home_score:8,away_score:0}:f);
 const changed=predictMatch({fixture:fixtures[4],competition,fixtures:changedRows,history,venues,matches:[],events:[],team:null,competitions:[competition]});
 assert.equal(base.expectedGoals.home,changed.expectedGoals.home);
 assert.equal(base.expectedGoals.away,changed.expectedGoals.away);
 assert.deepEqual(base.probabilities,changed.probabilities);
});

test('venue profile requires real comparable samples before affecting context',()=>{
 const result=predictMatch({fixture:fixtures[4],competition,fixtures,history,venues,matches:[],events:[],team:null,competitions:[competition]});
 const field=result.factors.find(x=>x.key==='venue');
 assert.ok(field);
 assert.match(field.detail,/almeno 2 precedenti/);
});

test('signature reacts to historical and venue profile changes',()=>{
 const a=predictionSignature({fixture:fixtures[4],fixtures,history,venues,events:[]});
 const b=predictionSignature({fixture:fixtures[4],fixtures,history:[{...history[0],points:50},history[1]],venues,events:[]});
 const c=predictionSignature({fixture:fixtures[4],fixtures,history,venues:[{...venues[0],width_profile:'narrow'},...venues.slice(1)],events:[]});
 assert.notEqual(a,b);assert.notEqual(a,c);
});


test('expected potential is separate from current form and uses historical strength',()=>{
 const result=predictMatch({fixture:fixtures[4],competition,fixtures,history,venues,matches:[],events:[],team:null,competitions:[competition]});
 assert.ok(Number.isFinite(result.home.potential));
 assert.ok(Number.isFinite(result.away.potential));
 assert.ok(Number.isInteger(result.home.potentialRank));
 assert.ok(Number.isInteger(result.away.potentialRank));
 assert.ok(result.home.potential>result.away.potential);
 assert.ok(result.factors.some(x=>x.key==='potential'));
});
