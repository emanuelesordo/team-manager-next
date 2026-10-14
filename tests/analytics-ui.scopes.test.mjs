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
test('Tournament scope aggregates recorded fixtures without repeating a league ranking',()=>{
 const fixtures=[
  {status:'finished',competition_id:'comp',home_team:'Caselle',away_team:'Ospiti',
   home_score:2,away_score:1},
  {status:'finished',competition_id:'comp',home_team:'Ospiti',away_team:'Caselle',
   home_score:1,away_score:1}
 ];
 const html=renderEventAnalytics(fixtures,[],[],{id:'caselle'},[{id:'comp',name:'Serie B'}],[],[],[],[],[],[],[],[],[]);
 assert.match(html,/Caselle/);
 assert.match(html,/Serie B/);
 assert.match(html,/Gol torneo registrati/);
 const scope=html.slice(html.indexOf('data-stats-panel="all"'));
 assert.doesNotMatch(scope,/standing-table/);
});
test('Complessivo focuses on verified match progression without repeating standings',()=>{
 const f={status:'finished',competition_id:'c',home_team:'Caselle',away_team:'Avversari',home_score:2,away_score:1};
 const flow={competition_id:'c',verified:true,duration:88,nil_minutes:30,draw_minutes:40,lead_minutes:48,trail_minutes:0,
  leads_taken:1,leads_lost:0,deficits_recovered:0,deficits_entered:0,comeback_equalizers:0,opponent_equalizers:0,
  goals_for:2,goals_against:1,substitutions_total:5,yellows_total:3,reds_total:0};
 const html=renderEventAnalytics([f],[],[],{id:'caselle'},[{id:'c',name:'Serie B'}],[],[],[],[],[],[],[],[],[],[flow]);
 const all=html.slice(html.indexOf('data-stats-panel="all"'));
 assert.match(all,/Tempo nello stato di risultato/);
 assert.match(all,/Vantaggi, svantaggi e rimonte/);
 assert.match(all,/0-0/);
 assert.doesNotMatch(all,/standing-table/);
});
