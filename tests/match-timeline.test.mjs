import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../fresh/main.js',import.meta.url),'utf8');
const begin=source.indexOf('function matchEventTimeline(');
const end=source.indexOf('\nfunction match(){',begin);
assert.ok(begin>=0&&end>begin,'match timeline function must be present');
const render=new Function('E',source.slice(begin,end)+';return matchEventTimeline;')(String);
const fixture={status:'finished',home_team:'Caselle',away_team:'Rivals',home_score:1,away_score:2};
const events=[
 {id:'first',minute:20,event_type:'goal',team_side:'home',player_id:'FirstHalf',payload:{period:'first_half'}},
 {id:'second',minute:28,event_type:'goal',team_side:'away',player_id:'SecondHalf',payload:{period:'second_half'}},
 {id:'late',minute:43,event_type:'goal',team_side:'away',player_id:'LateSecond',payload:{period:'second_half'}},
 {id:'change',minute:46,event_type:'substitution',team_side:'home',player_id:'Outgoing',secondary_player_id:'Incoming',payload:{period:'second_half'}},
 {id:'live',minute:63,event_type:'yellow_card',team_side:'home',player_id:'LiveAbsolute',payload:{entered_from:'tm_app_live'}},
 {id:'end',minute:null,stoppage_minute:7,event_type:'period_end',payload:{period:'second_half',recovery_minutes:7}}
];
const html=render(events,fixture,id=>id,{name:'Caselle'},{minutes_per_period:40});
test('40-minute halves convert historical second-half minute to cumulative minute',()=>{
 for(const minute of [20,63,68,83,86])assert.ok(html.includes(">"+minute+"'</b>"),'missing '+minute);
 assert.doesNotMatch(html,/>28'<\/b>/);
});
test('each stored event is displayed once, with halftime delimiter',()=>{
 for(const player of ['FirstHalf','SecondHalf','LateSecond','Outgoing','Incoming','LiveAbsolute']){
  assert.equal(html.split('>'+player+'<').length-1,1,player);
 }
 assert.ok(html.indexOf("68'")<html.indexOf('>HT<'));
 assert.ok(html.indexOf('>HT<')<html.indexOf("20'"));
});
test('goals keep chronological cumulative results',()=>{
 for(const score of ['1 - 0','1 - 1','1 - 2'])assert.ok(html.includes('>'+score+'</'),score);
});
test('stoppage divider uses period end settings rather than 45-minute default',()=>{
 assert.match(html,/RECUPERO \+7'/);
 assert.match(html,/FT 1 - 2/);
});
