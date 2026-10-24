import test from 'node:test';
import assert from 'node:assert/strict';
import {renderEventAnalytics} from '../fresh/analytics-ui.js';

test('Numeri has three non-overlapping scopes and five player metric categories',()=>{
 const html=renderEventAnalytics([],[],[],{id:'caselle'},[],[],[],[],[],[],[],[],[],[]);
 for(const name of ['Squadra · Caselle','Giocatori · Caselle','Complessivo · Torneo'])assert.ok(html.includes(name));
 for(const group of ['usage','attack','impact','rating','discipline'])assert.ok(html.includes('data-stats-ranking="'+group+'"'));
 assert.match(html,/data-stats-panel="team"/);
 assert.match(html,/data-stats-panel="players" hidden/);
 assert.match(html,/data-stats-panel="all" hidden/);
});
test('Numeri player comparison is sourced from consolidated SQL and includes goal and rating rankings',()=>{
 const p={season_id:'season',player_id:'p',first_name:'Luca',last_name:'Peruzzo',appearances:3,minutes:165,
   goals_for_on:8,goals_against_on:3,plus_minus_on:5,gf_on_per_80:3.88,
   ga_on_per_80:1.45,plus_minus_per_80:2.42,rated_matches:3,high_rating_games:1,
   goals_to_plus_1:1,comeback_go_ahead_goals:1};
 const html=renderEventAnalytics([],[],[],{id:'caselle'},[],[],[],[],[],[],[],[],[],[p]);
 assert.match(html,/Luca/);
 assert.match(html,/3,88/);
 assert.match(html,/Vantaggi in rimonta/);
 assert.match(html,/Variabilità/);
});

test('Team comparison visually ranks sides in each competition without a league table',()=>{
 const teams=[
  {competition_id:'c',team_name:'Calcio Caselle',played:3,verified_games:3,missing_games:0,
   lead_pct:52.1,trail_pct:0.7,nil_pct:41,leading_minutes:139,trailing_minutes:2,
   nil_minutes:118,scored_draw_minutes:8,comeback_equalizers:1,leads_taken:3},
  {competition_id:'c',team_name:'Justinense',played:3,verified_games:2,missing_games:1,
   lead_pct:30,trail_pct:35,nil_pct:20,leading_minutes:64,trailing_minutes:77,
   nil_minutes:40,scored_draw_minutes:20,comeback_equalizers:2,leads_taken:1}
 ];
 const html=renderEventAnalytics([],[],[],{id:'caselle'},[{id:'c',name:'Serie B'}],[],[],[],[],[],[],[],[],[],[],[],[],[],teams);
 const all=html.slice(html.indexOf('data-stats-panel="all"'));
 for(const label of ['Calcio Caselle','Justinense','Stato del risultato','Rimonte e vantaggi','Copertura','% in vantaggio','Pareggi in rimonta'])assert.ok(all.includes(label),label);
 assert.match(all,/data-team-metric-panel="changes" hidden/);
 assert.doesNotMatch(all,/standing-table/);
});

test('Opponent tournament comparison reads ordered score slots without requiring minutes',()=>{
 const fixtures=[{id:'f',competition_id:'c',status:'finished',is_test:false,home_team:'Justinense',away_team:'Rubano',home_score:2,away_score:1}];
 const goals=[
  {fixture_id:'f',event_type:'goal',team_side:'away',minute:null,validation_status:'official',payload:{sequence_order:1,count_score:true}},
  {fixture_id:'f',event_type:'goal',team_side:'home',minute:null,validation_status:'official',payload:{sequence_order:2,count_score:true}},
  {fixture_id:'f',event_type:'goal',team_side:'home',minute:null,validation_status:'official',payload:{sequence_order:3,count_score:true}}
 ];
 const args=Array(21).fill(undefined);
 args[0]=fixtures;args[1]=[];args[2]=[];args[3]={id:'caselle'};args[4]=[{id:'c',name:'Serie B'}];args[18]=[];args[19]=new Map();args[20]=goals;
 const html=renderEventAnalytics(...args);
 assert.match(html,/Andamento/);
 assert.match(html,/Partite in rimonta con punti/);
 assert.match(html,/Justinense/);
 assert.match(html,/Rubano/);
 assert.match(html,/Vittorie in trasferta/);
});
