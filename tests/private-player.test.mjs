import test from 'node:test';import assert from 'node:assert/strict';
import {staffPlayerHistory} from '../fresh/private-player.js';
const data={injuries:[{player_id:'p',team_id:'t',status:'recovering',injury_date:'2026-09-30',public_summary:'<img src=x onerror=alert(1)>'}],suspensions:[]};
test('player health history invisible to guest/player/coach',()=>{
 for(const role of ['player','fan','coach',undefined,null]){
  assert.equal(staffPlayerHistory(role,'p','t',data),'');
 }
});
test('staff view sanitizes health notes and protects other teams',()=>{
 const h=staffPlayerHistory('admin','p','t',data);
 assert.match(h,/RISERVATO STAFF/);assert.match(h,/recovering/);assert.doesNotMatch(h,/<img/);
 const other=staffPlayerHistory('admin','p','other',data);
 assert.doesNotMatch(other,/recovering/);
});
