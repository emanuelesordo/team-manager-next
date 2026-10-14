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
test('Tournament comparison uses both sides of every completed fixture',()=>{
 const fixtures=[
  {status:'finished',competition_id:'comp',home_team:'Caselle',away_team:'Ospiti',
   home_score:2,away_score:1},
  {status:'finished',competition_id:'comp',home_team:'Ospiti',away_team:'Caselle',
   home_score:1,away_score:1}
 ];
 const html=renderEventAnalytics(fixtures,[],[],{id:'caselle'},[{id:'comp',name:'Serie B'}],[],[],[],[],[],[],[],[],[]);
 assert.match(html,/Caselle/);
 assert.match(html,/Ospiti/);
 assert.match(html,/Serie B/);
 assert.match(html,/Gol complessivi/);
});