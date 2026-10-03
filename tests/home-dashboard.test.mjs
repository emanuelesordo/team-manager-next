import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {monthIndex,dateKey,renderMonthCalendar,opponentAdjustedResults,renderPointsTrend,renderPlayerRatingTrend} from '../fresh/home-dashboard.js';
import {CAROUSEL_INTERVAL} from '../fresh/config.js';

const main=readFileSync(new URL('../fresh/main.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../fresh/style.css',import.meta.url),'utf8');
const teamId='team-abc',otherId='opponent-1';
const fixture=(id,date,homeTeam,score=[null,null],competition='A')=>({
 id,competition_id:competition,kickoff_at:date,
 home_team_id:homeTeam?teamId:null,home_opponent_id:homeTeam?null:otherId,
 away_team_id:homeTeam?null:teamId,away_opponent_id:homeTeam?otherId:null,
 home_team:homeTeam?'Calcio Caselle':'Amatori Cadoneghe',
 away_team:homeTeam?'Amatori Cadoneghe':'Calcio Caselle',
 home_score:score[0],away_score:score[1],
 status:score[0]==null?'scheduled':'finished'
});
const crest=(name,size,ref)=>'<span class="crest" data-ref="'+(ref.opponent_id||ref.team_id)+'">'+name+'</span>';

test('two-slide carousel shows only latest finished and next game at eight-second cadence',()=>{
 assert.equal(CAROUSEL_INTERVAL,8000);
 const segment=main.slice(main.indexOf('function carouselFixtures(){'),main.indexOf('function hero(){'));
 assert.match(segment,/\[previous\(\),next\(\)\]/);
 assert.match(segment,/findIndex\(x=>x\.id===f\.id\)/);
 assert.doesNotMatch(segment,/\.slice\(0,5\)|reverse\(\)\.slice/);
 assert.match(main,/\[data-home-hero\]/);
 const change=main.slice(main.indexOf('function changeSlide('),main.indexOf('let gesture=null;'));
 assert.doesNotMatch(change,/render\(\).*innerHTML=hero/);
 assert.match(change,/slot\.innerHTML=hero\(\)/);
});
test('October 2026 calendar has Monday-first seven columns and opponent logo on exact match dates',()=>{
 const fixtures=[
  fixture('cadoneghe','2026-10-12T19:15:00Z',false),
  fixture('union','2026-10-05T19:00:00Z',true),
  fixture('november','2026-11-03T19:00:00Z',true)
 ];
 const markup=renderMonthCalendar(fixtures,teamId,2026*12+9,crest);
 assert.match(markup,/Ottobre 2026/);
 assert.equal((markup.match(/class="month-weekday"/g)||[]).length,7);
 assert.equal((markup.match(/class="month-cell(?! outside)/g)||[]).length,31);
 assert.match(markup,/data-match="cadoneghe"/);
 assert.match(markup,/data-ref="opponent-1"/);
 assert.match(markup,/data-match="union"/);
 assert.doesNotMatch(markup,/data-match="november"/);
 assert.equal(dateKey('2026-10-12T22:30:00Z'),'2026-10-13');
 assert.equal(monthIndex(new Date('2026-10-04T12:00:00Z')),2026*12+9);
});
test('projections use only games played before a fixture, never its eventual outcome',()=>{
 const past=[
  fixture('a','2026-09-01T20:00:00Z',true,[2,0]),
  fixture('b','2026-09-08T20:00:00Z',false,[0,1]),
  fixture('c','2026-09-15T20:00:00Z',true,[2,1])
 ];
 const early=opponentAdjustedResults(past,teamId);
 assert.equal(early.length,3);
 assert.equal(early.filter(r=>r.expected===null).length,2,'first two fixtures have insufficient prior data');
 assert.ok(early.some(r=>r.expected!==null),'estimate starts only after two prior games per club');
 const result=renderPointsTrend(early);
 assert.match(result,/Punti ottenuti/);
 assert.match(result,/Punti attesi \(stima\)/);
 assert.match(result,/almeno due incontri precedenti/);
 const ratings=renderPlayerRatingTrend([{avg_rating:6.5},{avg_rating:7.5}]);
 assert.match(ratings,/6\.5/);
 assert.match(ratings,/7\.5/);
 assert.doesNotMatch(renderPlayerRatingTrend([]),/polyline/);
});
test('home layout has month calendar, standings, linked player and trends instead of KPI strip',()=>{
 const home=main.slice(main.indexOf('function home(){'),main.indexOf('async function hydrateHomeRatings(){'));
 for(const className of ['home-side-stack','home-right-calendar','home-standing-section','home-player-section','home-expectation-section'])
  assert.match(home,new RegExp(className));
 assert.doesNotMatch(home,/\bkpis\(\)|fixture-list|home-bottom/);
 assert.match(css,/\.home-feature\{\s*display:grid;\s*grid-template-columns:minmax\(0,1\.09fr\) minmax\(320px,\.91fr\)/);
 assert.match(css,/\.month-days\{display:grid;grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);
 assert.match(main,/dataset\.homeMonth/);
});
