import test from 'node:test';
import assert from 'node:assert/strict';

// No network, credentials or localStorage dependency in the UI rendering checks.
globalThis.localStorage={getItem(){return null},setItem(){},removeItem(){}};
const {adminPage,staffMatchPanel,isStaff} = await import('../fresh/staff-ui.js');
const teamId='team',seasonId='season',compId='comp',fixtureId='fix',matchId='match',playerId='player';
const fixture={id:fixtureId,competition_id:compId,home_team:'Test Club',away_team:'Visitors',status:'scheduled'};
const player={id:playerId,first_name:'Giulia',last_name:'Rossi',generic_role_manual:'C'};
const base={
 team:{id:teamId,name:'Test Club',short_name:'TST'},
 seasons:[{id:seasonId,team_id:teamId,name:'2026/27',status:'active',start_date:'2026-07-01',end_date:'2027-06-30'}],
 opponents:[{id:'opp',name:'Visitors'}]
};
function context(role,matchStatus='scheduled'){
 const match={id:matchId,fixture_id:fixtureId,status:matchStatus,formation:'4-4-2',live_clock_running:false,live_clock_seconds:0};
 const state={identity:{role:role?{role}:null},base,season:seasonId,match:fixtureId,
  data:{competitions:[{id:compId,name:'League',minutes_per_period:40,discipline_rules:{blue_duration_minutes:5}}],
   fixtures:[fixture],roster:[{player_id:playerId,season_id:seasonId,active:true}],
   players:[player],matches:[match],injuries:[],suspensions:[],
   generalSeasons:[{id:'general',team_id:teamId,start_date:'2026-07-01',end_date:'2027-06-30'}],
   profiles:[],passwordRequests:[]},
  matchData:{players:[],events:[],ratings:[]}};
 return {state,heading:(x,y)=>x+' '+y,involvesTeam:()=>true};
}
test('guest/player cannot access administration or staff match controls',()=>{
 for(const role of [null,'player','fan']){
  const ctx=context(role);
  assert.equal(isStaff(ctx),false);
  assert.match(adminPage(ctx),/riservata/i);
  assert.equal(staffMatchPanel(ctx,fixture,ctx.state.data.matches[0]),'');
 }
});
test('admin navigation exposes configuration and editable roster without mock data',()=>{
 const ctx=context('admin');
 assert.equal(isStaff(ctx),true);
 const page=adminPage(ctx);
 assert.match(page,/Amministrazione/);
 assert.match(page,/Squadra/);
 assert.match(page,/Disponibilità/);
 assert.match(page,/Utenti/);
 const staff=staffMatchPanel(ctx,fixture,ctx.state.data.matches[0]);
 assert.match(staff,/Convocazioni/);
 assert.match(staff,/Giulia|Rossi/);
 assert.match(staff,/lineup-row/);
});
test('manager has sports controls but no user-management tab',()=>{
 const ctx=context('manager');
 const html=adminPage(ctx);
 assert.match(html,/Disponibilità/);
 assert.doesNotMatch(html,/data-staff-area="users"/);
 const panel=staffMatchPanel(ctx,fixture,ctx.state.data.matches[0]);
 assert.match(panel,/Convocazioni/);
});
test('finished game displays disabled lineup editing',()=>{
 const ctx=context('admin','finished');
 const html=staffMatchPanel(ctx,fixture,ctx.state.data.matches[0]);
 assert.match(html,/disabled/);
 assert.match(html,/bloccata dopo il fischio/);
});
