import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregateEventDetails} from '../fresh/event-detail-stats.js';
const ev=(id,type,payload,player='p1',side='team',validation='official')=>({id,event_type:type,payload,player_id:player,team_side:side,validation_status:validation});
test('distribuzioni separate per giocatore e squadra e copertura incompleta',()=>{
 const rows=[
  ev('1','goal',{goal_details:{body_part:'head',dynamics:'personal_action',distance_zone:'16_25',shot:{x:34,y:20}}}),
  ev('2','goal',{}),ev('3','goal',{goal_details:{body_part:'foot',play_type:'open_play'}},'p2'),
  ev('4','yellow_card',{disciplinary_reason:'protest'}),
  ev('5','substitution',{substitution_motivation:'injury'}),
  ev('6','yellow_card',{disciplinary_reason:'foul'},'p2'),
  ev('7','goal',{goal_details:{body_part:'knee'}},'p1','team','proposed'),
  ev('8','goal',{goal_details:{body_part:'head'}},'p1','opponent'),
  ev('9','goal',{goal_details:{body_part:'head'},counted_in_score:false})
 ];
 const team=aggregateEventDetails(rows,{side:'team'});
 assert.equal(team.groups.body_part.total,3);
 assert.equal(team.groups.body_part.known,2);
 assert.equal(team.groups.body_part.unknown,1);
 assert.equal(team.groups.dynamics.counts.personal_action,1);
 assert.equal(team.groups.disciplinary_reason.counts.protest,1);
 assert.equal(team.groups.disciplinary_reason.counts.foul,1);
 assert.equal(team.groups.substitution_motivation.counts.injury,1);
 assert.deepEqual(team.points.shot,[{x:34,y:20}]);
 const player=aggregateEventDetails(rows,{side:'team',playerId:'p1'});
 assert.equal(player.groups.body_part.known,1);
 assert.equal(player.groups.disciplinary_reason.total,1);
 assert.equal(player.groups.substitution_motivation.total,1);
});
