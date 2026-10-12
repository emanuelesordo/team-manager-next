import test from 'node:test';
import assert from 'node:assert/strict';
import {analyseResults} from '../fresh/result-intelligence.js';

const competition={id:'L',win_points:3,draw_points:1,loss_points:0};
const f=(id,date,home,away,hs,as,status='finished')=>({
 id,competition_id:'L',kickoff_at:date,
 home_team_id:null,away_team_id:null,home_opponent_id:home,away_opponent_id:away,
 home_score:hs,away_score:as,status
});
const fixtures=[
 f('1','2026-09-01T20:00:00Z','A','B',1,0),
 f('2','2026-09-08T20:00:00Z','B','C',2,2),
 f('3','2026-09-15T20:00:00Z','C','A',0,3),
 f('4','2026-09-22T20:00:00Z','A','B',2,2),
 f('5','2026-09-29T20:00:00Z','A','C',0,1)
];
test('result intelligence works entirely without goals/events',()=>{
 const r=analyseResults(fixtures,'opponent:A',{competitions:[competition]});
 assert.equal(r.played,4);
 assert.equal(r.bothScore.count,1);
 assert.equal(r.totalGoals.zeroOne,2);
 assert.equal(r.totalGoals.two,0);
 assert.equal(r.totalGoals.threePlus,2);
 assert.equal(r.margins.win1,1);
 assert.equal(r.margins.win3plus,1);
 assert.equal(r.margins.loss1,1);
 assert.equal(r.margins.draw,1);
 assert.equal(r.venue.home.matches,3);
 assert.equal(r.venue.away.matches,1);
 assert.equal(r.vsPrediction.matches,0);
 assert.equal(r.vsPrediction.delta,null);
 assert.ok(r.strength.trend.length===4);
});
test('filters future games before computing opponent strength and form',()=>{
 const before='2026-09-20T00:00:00Z';
 const a=analyseResults(fixtures,'opponent:A',{competitions:[competition],before});
 const changed=fixtures.map(x=>x.id==='5'?{...x,home_score:10,away_score:0}:x);
 const b=analyseResults(changed,'opponent:A',{competitions:[competition],before});
 assert.deepEqual(a,b);
 assert.equal(a.played,2);
});
test('archived predictions are used only if saved before kickoff',()=>{
 const before={fixture_id:'1',generated_at:'2026-08-30T11:00:00Z',home_probability:.6,draw_probability:.25,away_probability:.15};
 const late={fixture_id:'3',generated_at:'2026-09-16T00:00:00Z',home_probability:.2,draw_probability:.25,away_probability:.55};
 const r=analyseResults(fixtures,'opponent:A',{competitions:[competition],predictionSnapshots:[before,late]});
 assert.equal(r.vsPrediction.matches,1);
 assert.ok(Math.abs(r.vsPrediction.expectedPoints-(.6*3+.25))<1e-8);
 assert.ok(Math.abs(r.vsPrediction.delta-(3-(.6*3+.25)))<1e-8);
});
test('field profiles need configured venue names, no invented categories',()=>{
 const rows=fixtures.map((x,i)=>({...x,venue_name:i%2?'Sintetico':'Erba'}));
 const r=analyseResults(rows,'opponent:A',{competitions:[competition],venues:[
  {name:'Sintetico',surface_type:'synthetic'},{name:'Erba',surface_type:'natural'}
 ]});
 assert.equal(r.venue.bySurface.reduce((s,x)=>s+x.matches,0),4);
 assert.equal(r.venue.bySurface.length,2);
});
