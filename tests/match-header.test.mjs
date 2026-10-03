import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {matchScorerRows,renderMatchScorers} from '../fresh/match-scorers.js';

const main=readFileSync(new URL('../fresh/main.js',import.meta.url),'utf8');
const team={id:'team-uuid',name:'Calcio Caselle',short_name:'CAS',logo_url:'https://example.test/caselle.png'};
const opponents=[{id:'voltesea-uuid',name:'Voltesea',short_name:'VOL',logo_url:'https://example.test/voltesea.png'}];
const fixture={home_team:'Voltesea Calcio',away_team:'Calcio Caselle',
 home_opponent_id:opponents[0].id,home_team_id:null,
 away_team_id:team.id,away_opponent_id:null,home_score:1,away_score:4};
const competition={minutes_per_period:40};
const events=[
 {event_type:'goal',team_side:'opponent',minute:18,payload:{period:'second_half'},validation_status:'official'},
 {event_type:'goal',team_side:'team',minute:20,player_id:'p1',payload:{period:'second_half'},validation_status:'official'},
 {event_type:'goal',team_side:'team',minute:28,player_id:'p2',secondary_player_id:'p4',payload:{period:'second_half'},validation_status:'official'},
 {event_type:'goal',team_side:'team',minute:43,player_id:'p2',payload:{period:'second_half'},validation_status:'official'},
 {event_type:'goal',team_side:'team',minute:46,player_id:'p3',payload:{period:'second_half'},validation_status:'official'},
 {event_type:'yellow_card',team_side:'team',minute:47,player_id:'p1',payload:{period:'second_half'},validation_status:'official'}
];
const names={p1:'Rossi',p2:'Verdi',p3:'Neri',p4:'Assistente'};

test('fixture badge references are UUID foreign keys, never a text alias',()=>{
 assert.ok(main.includes('ref?.team_id'));
 assert.ok(main.includes('ref?.opponent_id'));
 assert.ok(main.includes('o.id===ref.opponent_id'));
 assert.ok(main.includes('club(f.home_team,\'tiny\',{team_id:f.home_team_id,opponent_id:f.home_opponent_id})'));
 assert.ok(main.includes('club(r.team,\'tiny\',{team_id:r.team_id,opponent_id:r.opponent_id})'));
 assert.doesNotMatch(main,/findClubIdentity|canonicalClubName/);
});
test('stored UUID remains authoritative when the display label changes',()=>{
 const renamed={...fixture,home_team:'Qualsiasi nome',away_team:'Nome modificato'};
 assert.equal(renamed.home_opponent_id,fixture.home_opponent_id);
 assert.equal(renamed.away_team_id,fixture.away_team_id);
 const homeIdentity=opponents.find(o=>o.id===renamed.home_opponent_id);
 assert.equal(homeIdentity,opponents[0]);
});
test('scorers use the team_id to decide which side is the home side',()=>{
 const rows=matchScorerRows(events,fixture,team,id=>names[id],competition);
 assert.equal(rows.home.length,1);
 assert.equal(rows.away.length,4);
 assert.equal(rows.home[0].minuteText,'58′');
 assert.deepEqual(rows.away.map(x=>x.minute),[60,68,83,86]);
 const h=renderMatchScorers(rows,'home',x=>x),a=renderMatchScorers(rows,'away',x=>x);
 assert.match(h,/Marcatore non indicato/);
 assert.match(a,/Rossi/);
 assert.match(a,/Verdi/);
 assert.doesNotMatch(a,/Assistente/);
 assert.equal((a.match(/class="match-header-scorer"/g)||[]).length,4);
});
test('rejected and non-goal events never enter the scoreboard',()=>{
 const rows=matchScorerRows([...events,{event_type:'goal',team_side:'team',minute:49,validation_status:'rejected'}],
 fixture,team,id=>names[id],competition);
 assert.equal(rows.away.length,4);
});
