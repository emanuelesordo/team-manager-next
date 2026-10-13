import test from 'node:test';
import assert from 'node:assert/strict';
import {playerIntelligence,renderPlayerIntelligence} from '../fresh/player-intelligence.js';

const fixture={id:'f1',status:'finished',home_team_id:'team',away_team_id:'opp',home_score:2,away_score:1,competition_id:'c1',kickoff_at:'2026-10-01T20:00:00Z'};
const match={id:'m1',fixture_id:'f1',status:'finished'};
const competition={id:'c1',minutes_per_period:40,periods:2};
const base={fixtures:[fixture],matches:[match],matchPlayers:[{match_id:'m1',player_id:'p',started:false,selection_status:'bench'},{match_id:'m1',player_id:'out',started:true}],events:[
 {match_id:'m1',event_type:'goal',minute:30,team_side:'away',player_id:'opp'},
 {match_id:'m1',event_type:'substitution',minute:55,team_side:'home',player_id:'out',secondary_player_id:'p'},
 {match_id:'m1',event_type:'goal',minute:60,team_side:'home',player_id:'p'},
 {match_id:'m1',event_type:'goal',minute:70,team_side:'home',player_id:'other',secondary_player_id:'p'},
].map(e=>({...e,validation_status:'official'})),competitions:[competition],team:{id:'team'}};

test('substitute: 25 minutes, +2 on field, goal and assist',()=>{
 const result=playerIntelligence('p',base);
 assert.equal(result.games,1);
 assert.equal(result.starts,0);
 assert.equal(result.minutes,25);
 assert.equal(result.goals,1);
 assert.equal(result.assists,1);
 assert.equal(result.subGoals,1);
 assert.equal(result.gfOn,2);
 assert.equal(result.gaOn,0);
 assert.equal(result.gfOff,0);
 assert.equal(result.gaOff,1);
 assert.equal(result.covered,1);
 assert.equal(result.entryPointsDelta,3);
 assert.ok(renderPlayerIntelligence('p',base).includes('Plus/minus'));
});
test('a missing goal minute suppresses on/off and preserves personal recorded goals',()=>{
 const broken={...base,events:base.events.map((e,i)=>i===2?{...e,minute:null}:e)};
 const result=playerIntelligence('p',broken);
 assert.equal(result.covered,0);
 assert.equal(result.goals,1);
 assert.equal(result.gfOn,0);
 assert.equal(result.matches[0].pm,null);
});
test('conflicting recorded minutes invalidate presence intervals',()=>{
 const changed={...base,matchPlayers:base.matchPlayers.map(x=>({...x,minutes_played:45}))};
 const result=playerIntelligence('p',changed);
 assert.equal(result.covered,0);
 assert.equal(result.minutesKnown,0);
});
test('rejected goals do not contribute to the statistics',()=>{
 const changed={...base,events:base.events.map((x,i)=>i===2?{...x,validation_status:'rejected'}:x)};
 const result=playerIntelligence('p',changed);
 assert.equal(result.goals,0);
 assert.equal(result.covered,0);
});

test('player card uses canonical roster minutes for displayed total and per-goal ratios',()=>{
 const html=renderPlayerIntelligence('p',{...base,stats:{minutes:49}});
 assert.match(html,/Minuti giocati<\/span><strong>49′/);
 assert.match(html,/Minuti \/ gol<\/span><strong>49′/);
 assert.match(html,/Stessa fonte verificata della Rosa/);
});

test('canonical roster counts govern appearances, starters, subentries, goals and cards',()=>{
 const html=renderPlayerIntelligence('p',{...base,stats:{appearances:3,starts:2,minutes:49,goals:4,assists:2,yellow_cards:3,red_cards:1}});
 assert.match(html,/Presenze<\/span><strong>3<\/strong><small>2 titolare · 1 subentrato/);
 assert.match(html,/Gol \+ assist<\/span><strong>6/);
 assert.match(html,/Ammonizioni<\/span><strong>3/);
 assert.match(html,/Espulsioni<\/span><strong>1/);
 assert.match(html,/Gol da subentrato<\/span><strong>—/);
});

test('SQL appearances remain authoritative even if local events claim extra entries',()=>{
 const source={...base,matches:[
  {id:'m1',status:'finished'}, {id:'m2',status:'finished'}, {id:'m3',status:'finished'}
 ],events:[...base.events,
  {match_id:'m2',event_type:'substitution',minute:70,team_side:'team',secondary_player_id:'p',validation_status:'official'},
  {match_id:'m3',event_type:'substitution',minute:51,team_side:'team',secondary_player_id:'p',validation_status:'official'}
 ],stats:{appearances:2,starts:0,minutes:49}};
 const html=renderPlayerIntelligence('p',source);
 assert.ok(html.includes('0 titolare · 2 subentrato'));
});

test('authoritative SQL zero minutes and no entered match must not become invented local minutes',()=>{
 const html=renderPlayerIntelligence('p',{...base,stats:{appearances:1,starts:0,subentries:1,minutes:null,minutes_coverage:'unavailable',goals:1,assists:1,yellow_cards:0,red_cards:0}});
 assert.match(html,/Minuti giocati<\/span><strong>—/);
 assert.match(html,/Minuti \/ gol<\/span><strong>—/);
 assert.match(html,/GF in campo<\/span><strong>—/);
});
test('a SQL aggregate mismatch preserves official totals and withholds misleading derived splits',()=>{
 const html=renderPlayerIntelligence('p',{...base,stats:{appearances:3,starts:0,subentries:3,minutes:50,minutes_coverage:'complete',goals:4,assists:2,yellow_cards:2,red_cards:1}});
 assert.match(html,/Presenze<\/span><strong>3/);
 assert.match(html,/Subentrato<\/span><strong>3/);
 assert.match(html,/Gol<\/span><strong>4/);
 assert.match(html,/Ammonizioni<\/span><strong>2/);
 assert.match(html,/Gol da subentrato<\/span><strong>—/);
 assert.match(html,/Plus\/minus<\/span><strong>—/);
 assert.match(html,/Minuti per partita<\/h3><p class="psi-note">/);
});
test('missing event feed does not certify any detailed results or minutes chart',()=>{
 const html=renderPlayerIntelligence('p',{...base,events:[],eventsLoaded:false,playersLoaded:false,
  stats:{appearances:1,starts:0,subentries:1,minutes:25,minutes_coverage:'complete',goals:1,assists:1}});
 assert.match(html,/Minuti giocati<\/span><strong>25′/);
 assert.match(html,/Gol da subentrato<\/span><strong>—/);
 assert.match(html,/Minuti per partita<\/h3><p class="psi-note">/);
});

test('a goal at the last minute of declared recovery counts while the player is still on the field',()=>{
 const f={...fixture,home_score:1,away_score:0};
 const source={...base,fixtures:[f],events:[
  {match_id:'m1',event_type:'substitution',minute:51,team_side:'team',player_id:'out',secondary_player_id:'p',validation_status:'official',payload:{period:'second_half',entered_from:'tm_app_live'}},
  {match_id:'m1',event_type:'goal',minute:80,stoppage_minute:4,team_side:'team',player_id:'p',validation_status:'official',payload:{period:'second_half',entered_from:'tm_app_live'}},
  {match_id:'m1',event_type:'period_end',validation_status:'official',payload:{period:'first_half',recovery_actual:6}},
  {match_id:'m1',event_type:'period_end',validation_status:'official',payload:{period:'second_half',recovery_actual:4}}
 ],matches:[{...match,home_away:'home'}]};
 const v=playerIntelligence('p',source);
 assert.equal(v.covered,1);
 assert.equal(v.minutes,33);
 assert.equal(v.gfOn,1);
 assert.equal(v.goals,1);
});
