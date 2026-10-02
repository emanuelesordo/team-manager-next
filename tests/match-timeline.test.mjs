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

test('recovery starts at the configured minute inclusive in each half',()=>{
 const boundary=[
  {minute:39,event_type:'yellow_card',team_side:'home',player_id:'preFirst',payload:{period:'first_half'}},
  {minute:40,event_type:'goal',team_side:'home',player_id:'startFirst',payload:{period:'first_half'}},
  {minute:1,event_type:'goal',team_side:'away',player_id:'startSecond',payload:{period:'second_half'}},
  {minute:39,event_type:'goal',team_side:'away',player_id:'preSecond',payload:{period:'second_half'}},
  {minute:40,event_type:'goal',team_side:'away',player_id:'startRecoverySecond',payload:{period:'second_half'}},
  {event_type:'period_end',minute:null,payload:{period:'first_half',recovery_minutes:2}},
  {event_type:'period_end',minute:null,payload:{period:'second_half',recovery_minutes:7}}
 ];
 const rendered=render(boundary,fixture,id=>id,{name:'Caselle'},{minutes_per_period:40});
 const at=text=>rendered.indexOf(text);
 assert.ok(at("80'</b>")<at("RECUPERO +7'")&&at("RECUPERO +7'")<at("79'</b>"),'second-half boundary');
 assert.ok(at("40'</b>")<at("RECUPERO +2'")&&at("RECUPERO +2'")<at("39'</b>"),'first-half boundary');
 assert.equal(rendered.split('RECUPERO').length-1,2);
});

test('declared recovery is shown in both halves even without stoppage-time events',()=>{
 const noStoppageEvents=[
  {minute:20,event_type:'goal',team_side:'home',player_id:'first',payload:{period:'first_half'}},
  {minute:28,event_type:'goal',team_side:'away',player_id:'second',payload:{period:'second_half'}},
  {event_type:'period_end',minute:null,stoppage_minute:2,payload:{period:'first_half'}},
  {event_type:'period_end',minute:null,stoppage_minute:7,payload:{period:'second_half'}}
 ];
 const output=render(noStoppageEvents,fixture,id=>id,{name:'Caselle'},{minutes_per_period:40});
 assert.ok(output.indexOf('>HT<')<output.indexOf("RECUPERO +2'"));
 assert.ok(output.indexOf("RECUPERO +2'")<output.indexOf("20'</b>"));
 assert.ok(output.indexOf("RECUPERO +7'")<output.indexOf("68'</b>"));
 assert.equal(output.split('RECUPERO').length-1,2);
});
