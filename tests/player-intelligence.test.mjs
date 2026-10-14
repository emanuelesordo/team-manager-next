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

test('cumulative plus-minus chart does not silently skip unknown game contributions',()=>{
 const g={...base,fixtures:[fixture,{...fixture,id:'f2',kickoff_at:'2026-10-08T20:00:00Z'}],
 matches:[match,{...match,id:'m2',fixture_id:'f2'}],
 matchPlayers:[...base.matchPlayers,{match_id:'m2',player_id:'p',started:true}],
 events:[...base.events,{match_id:'m2',event_type:'goal',minute:null,team_side:'home',player_id:'p',validation_status:'official'}]};
 const result=playerIntelligence('p',g);
 assert.equal(result.matches.length,2);
 assert.equal(result.trend[0].verified,true);
 assert.equal(result.trend[1].value,null);
});

test('minuti per partita comes from confirmed SQL per-match facts, not local partial sums',()=>{
 const source={...base,stats:{appearances:1,starts:0,subentries:1,minutes:25,minutes_coverage:'complete',
  goals:1,assists:1,match_minutes:[{match_id:'m1',minutes:25,valid:true,appeared:true}]}};
 const html=renderPlayerIntelligence('p',source);
 assert.match(html,/Minuti per partita<\/h3><div class="psi-line-wrap">/);
});
test('a player with no starts has all official goals and assists as a substitute',()=>{
 const source={...base,matches:[],events:[],matchPlayers:[],stats:{
  appearances:3,starts:0,subentries:3,minutes:50,minutes_coverage:'complete',goals:1,assists:2}};
 const html=renderPlayerIntelligence('p',source);
 assert.match(html,/Gol da subentrato<\/span><strong>1/);
 assert.match(html,/Assist da subentrato<\/span><strong>2/);
});

test('Luca Peruzzo three conceded goals across three games count in GF/GS on-field',()=>{
 const matches=[
  {id:'sep',fixture_id:'fsep',status:'finished',home_away:'away'},
  {id:'oct5',fixture_id:'foct5',status:'finished',home_away:'home'},
  {id:'oct12',fixture_id:'foct12',status:'finished',home_away:'away'}
 ];
 const fixtures=[
  {id:'fsep',status:'finished',away_team_id:'team',home_score:1,away_score:4,competition_id:'c1',kickoff_at:'2026-09-28T20:00:00Z'},
  {id:'foct5',status:'finished',home_team_id:'team',home_score:2,away_score:1,competition_id:'c1',kickoff_at:'2026-10-05T20:00:00Z'},
  {id:'foct12',status:'finished',away_team_id:'team',home_score:1,away_score:6,competition_id:'c1',kickoff_at:'2026-10-12T20:00:00Z'}
 ];
 const rows=[
  {match_id:'sep',player_id:'luca',started:true},
  {match_id:'oct5',player_id:'luca',started:false},
  {match_id:'oct5',player_id:'out5',started:true},
  {match_id:'oct12',player_id:'luca',started:false},
  {match_id:'oct12',player_id:'out12',started:true}
 ];
 const ev=(match_id,event_type,minute,side,more={})=>({match_id,event_type,minute,team_side:side,validation_status:'official',...more});
 const end=(match_id,period,minutes,stamp,legacy=false)=>ev(match_id,'period_end',null,'team',{
  created_at:stamp,payload:{period,...(legacy?{recovery_minutes:minutes}:{recovery_actual:minutes,entered_from:'period_control'})}
 });
 const goals=[
  ...[[18,'opponent'],[20,'team'],[28,'team'],[43,'team'],[46,'team']].map(([min,side])=>ev('sep','goal',min,side,{payload:{period:'second_half'}})),
  ...[[44,'team'],[56,'team'],[65,'opponent']].map(([min,side])=>ev('oct5','goal',min,side,{payload:{period:'second_half',entered_from:'tm_app_live'}})),
  ...[[11,'team'],[19,'team'],[23,'team']].map(([min,side])=>ev('oct12','goal',min,side,{payload:{period:'first_half',entered_from:'tm_app_live'}})),
  ...[[50,'team'],[58,'team'],[71,'opponent']].map(([min,side])=>ev('oct12','goal',min,side,{payload:{period:'second_half',entered_from:'tm_app_live'}})),
  ev('oct12','goal',80,'team',{stoppage_minute:4,payload:{period:'second_half',entered_from:'tm_app_live'}})
 ];
 const events=[...goals,
  ev('oct5','substitution',40,'team',{player_id:'out5',secondary_player_id:'luca',payload:{period:'halftime'}}),
  ev('oct12','substitution',53,'team',{player_id:'out12',secondary_player_id:'luca',payload:{period:'second_half',entered_from:'tm_app_live'}}),
  end('sep','first_half',2,'2026-09-28T21:00:00Z',true),
  end('sep','second_half',7,'2026-09-28T22:00:00Z',true),
  end('oct5','first_half',3,'2026-10-05T21:00:00Z'),
  end('oct5','second_half',5,'2026-10-05T22:00:00Z'),
  end('oct12','first_half',6,'2026-10-12T21:00:00Z'),
  end('oct12','second_half',4,'2026-10-12T22:00:00Z'),
  // Imported duplicates, intentionally LAST in API response: they must not overwrite actual recoveries.
  end('oct12','first_half',5,'2026-10-12T20:30:00Z',true),
  end('oct12','second_half',3,'2026-10-12T21:30:00Z',true)
 ];
 const r=playerIntelligence('luca',{matches,fixtures,matchPlayers:rows,events,competitions:[competition],team:{id:'team'}});
 assert.equal(r.games,3);assert.equal(r.covered,3);
 assert.equal(r.gaOn,3);
 assert.deepEqual(r.matches.map(x=>x.minutes),[89,45,31]);
});

test('player impact uses materialized Supabase goals even when local chronology is missing',()=>{
 const html=renderPlayerIntelligence('p',{
  ...base,events:[],matchPlayers:[],eventsLoaded:false,playersLoaded:false,
  stats:{appearances:1,starts:0,subentries:1,minutes:25,minutes_coverage:'complete',goals:1,assists:0,
   goals_for_on:2,goals_against_on:1,plus_minus_on:1,impact_coverage:'complete'},
  calculatedPlayers:[{match_id:'m1',player_id:'p',appeared:true,goals_for_on:2,goals_against_on:1,plus_minus:1,score_coverage:'complete'}]
 });
 assert.match(html,/GF in campo<\/span><strong>2/);
 assert.match(html,/GS in campo<\/span><strong>1/);
 assert.match(html,/Plus\/minus<\/span><strong>\+1/);
});

test('on-field per-80 metrics use the same persisted 165 minutes as the 8/3/+5 SQL totals',()=>{
 const html=renderPlayerIntelligence('luca',{...base,stats:{
  appearances:3,starts:1,subentries:2,minutes:165,minutes_coverage:'complete',
  goals:0,assists:0,goals_for_on:8,goals_against_on:3,plus_minus_on:5,impact_coverage:'complete'
 },calculatedPlayers:[
  {player_id:'luca',match_id:'a',appeared:true,minutes:89,goals_for_on:4,goals_against_on:1,score_coverage:'complete'},
  {player_id:'luca',match_id:'b',appeared:true,minutes:45,goals_for_on:2,goals_against_on:1,score_coverage:'complete'},
  {player_id:'luca',match_id:'c',appeared:true,minutes:31,goals_for_on:2,goals_against_on:1,score_coverage:'complete'}
 ]});
 assert.match(html,/GF \/ 80′<\/span><strong>3\.88/);
 assert.match(html,/GS \/ 80′<\/span><strong>1\.45/);
 assert.match(html,/\+\/- \/ 80′<\/span><strong>2\.42/);
});
