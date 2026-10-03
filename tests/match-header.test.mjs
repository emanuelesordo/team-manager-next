import test from 'node:test';
import assert from 'node:assert/strict';
import {findClubIdentity,canonicalClubName} from '../fresh/club-identity.js';
import {matchScorerRows,renderMatchScorers} from '../fresh/match-scorers.js';

const home={name:'Calcio Caselle',short_name:'CAS',logo_url:'https://example.test/caselle.png'};
const opponents=[{name:'Voltesea',short_name:'VOL',logo_url:'https://example.test/voltesea.png'}];
const fixture={home_team:'Voltesea Calcio',away_team:'Calcio Caselle',home_score:1,away_score:4};
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

test('fixture alias Voltesea Calcio resolves Voltesea logo stored in setup',()=>{
 assert.equal(canonicalClubName('Voltesea Calcio'),'voltesea');
 assert.equal(findClubIdentity('Voltesea Calcio',home,opponents),opponents[0]);
 assert.equal(findClubIdentity('Calcio Caselle',home,opponents),home);
 assert.equal(findClubIdentity('unknown',home,opponents),null);
});

test('ambiguous abbreviated aliases never borrow another team logo',()=>{
 const conflicting=[...opponents,{name:'Voltesea ASD'}];
 assert.equal(findClubIdentity('Voltesea Calcio',home,conflicting),null);
});

test('match header displays only minute and scorer beneath actual home/away side',()=>{
 const rows=matchScorerRows(events,fixture,home,id=>names[id],competition);
 assert.equal(rows.home.length,1);
 assert.equal(rows.away.length,4);
 assert.equal(rows.home[0].minuteText,'58′');
 assert.deepEqual(rows.away.map(x=>x.minute),[60,68,83,86]);
 const h=renderMatchScorers(rows,'home',x=>x);
 const a=renderMatchScorers(rows,'away',x=>x);
 assert.match(h,/Marcatore non indicato/);
 assert.match(a,/Rossi/);
 assert.match(a,/Verdi/);
 assert.doesNotMatch(a,/Assistente/);
 assert.equal((a.match(/class="match-header-scorer"/g)||[]).length,4);
});

test('rejected and non-goal events are excluded without inferred scorers',()=>{
 const rows=matchScorerRows([...events,{event_type:'goal',team_side:'team',minute:49,validation_status:'rejected'}],
 fixture,home,id=>names[id],competition);
 assert.equal(rows.away.length,4);
});

test('every current 2026/27 competition fixture resolves its stored club logo',()=>{
 const club={name:'Calcio Caselle',logo_url:'https://example.test/caselle.png'};
 const opponents=[
  'Armistizio','Bronzola','Cadoneghe','Campodoro','Cavinese Airone',
  'Justinense','Quadrato Meticcio','San Bastian','San Marco Stigliano',
  'Straelle','Union Rubano','Voltesea'
 ].map(name=>({name,logo_url:'https://example.test/'+name+'.png'}));
 const fixtures={
  'Amatori Armistizio':'Armistizio',
  'Amatori Bronzola':'Bronzola',
  'Amatori Cadoneghe':'Cadoneghe',
  'Calcio Caselle':'Calcio Caselle',
  'Calcio Cavinese Airone':'Cavinese Airone',
  'D.G. San Bastian':'San Bastian',
  'Justinense':'Justinense',
  'Quadrato Meticcio':'Quadrato Meticcio',
  'San Marco Stigliano':'San Marco Stigliano',
  'Spd Campodoro':'Campodoro',
  'Straelle':'Straelle',
  'Union Rubano A.S.D.':'Union Rubano',
  'Voltesea Calcio':'Voltesea'
 };
 for(const [fixtureName,registryName] of Object.entries(fixtures)){
  const identity=findClubIdentity(fixtureName,club,opponents);
  assert.ok(identity, 'Cannot resolve '+fixtureName);
  assert.equal(identity.name,registryName);
  assert.ok(identity.logo_url);
 }
});
