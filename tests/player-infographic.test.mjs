import test from 'node:test';
import assert from 'node:assert/strict';
import {intervalChart,renderPlayerOverview} from '../fresh/player-infographic-overview.js';

test('overview keeps exactly eight infographic cards in the mockup order',()=>{
 const html=renderPlayerOverview({id:'p1',stats:{avg_rating:7.4,goals:2,assists:1,yellow_cards:1,red_cards:0},
  analysis:{teamGoalsDuringAppearances:7},games:3,starts:2,minutes:190,goals:2,assists:1,
  results:{W:2,D:0,L:1},resultsComplete:true,scoreResults:true});
 assert.equal((html.match(/class="psi-info-card /g)||[]).length,8);
 for(const title of ['Ultime 5 partite','Gol e assist per intervallo','Risultati con lui in campo',
  'Trend rating','Rendimento','Eventi disciplinari','Risultati e impatto','Contributi decisivi'])
  assert.ok(html.includes(title),title);
 assert.match(html,/data-psi-rating-recent/);
 assert.match(html,/data-psi-rating-trend/);
 assert.doesNotMatch(html,/>NaN<|>undefined</);
});

test('goal/assist histogram uses only completely validated event counts',()=>{
 const verified=intervalChart([6,36,77],[17,54],{complete:true,goalCount:3,assistCount:2});
 assert.match(verified,/psi-info-barplot/);
 assert.match(verified,/0–15/);
 assert.match(verified,/76\+/);
 for(const source of [
  {complete:false,goalCount:3,assistCount:2},
  {complete:true,goalCount:4,assistCount:2}
 ])assert.doesNotMatch(intervalChart([6,36,77],[17,54],source),/psi-info-barplot/);
});

test('no made-up outcomes or derived totals when coverage is incomplete',()=>{
 const html=renderPlayerOverview({id:'player',stats:{appearances:2},analysis:{},
  games:2,starts:0,minutes:null,goals:null,assists:null,resultsComplete:false,fullImpact:false});
 assert.match(html,/copertura insufficiente/);
 assert.match(html,/Distribuzione N\/D/);
 assert.match(html,/>N\/D<\/strong>/);
 assert.doesNotMatch(html,/NaN|Infinity/);
});

test('SQL goal context and on-field figures remain distinct from estimated outcomes',()=>{
 const html=renderPlayerOverview({
  id:'p',stats:{goals_for_on:7,goals_against_on:3,avg_rating:6.8,yellow_cards:1,red_cards:0},
  games:3,starts:3,minutes:160,goals:2,assists:0,fullImpact:true,
  impact:{go_ahead_goals:1,equalizers:1,comeback_go_ahead_goals:0},
  results:{W:2,D:1,L:0},resultsComplete:true,scoreResults:true,analysis:{starterPoints:7,teamGoalsDuringAppearances:9}
 });
 assert.match(html,/Gol fatti quando in campo/);
 assert.match(html,/Gol subiti quando in campo/);
 assert.match(html,/>7<\/strong>/);
 assert.match(html,/>3<\/strong>/);
 assert.match(html,/>1<\/strong>/);
});
