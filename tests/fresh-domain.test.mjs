import test from 'node:test';import assert from 'node:assert/strict';
import{hasScore,scoreOf,summary,isOurs,fixtureToMatch,roleName,isLive,rankRows}from'../fresh/domain.js';
const team={name:'Calcio Caselle',short_name:'CAS'};
const f=(hs,as,status='finished',home='Calcio Caselle',away='Avversari')=>({home_score:hs,away_score:as,status,home_team:home,away_team:away,kickoff_at:'2026-09-28T19:00:00Z',competition_id:'C'});
test('zero-zero valido e null non confuso con zero',()=>{assert.equal(hasScore(f(0,0)),true);assert.equal(scoreOf(f(0,0)),'0 : 0');assert.equal(hasScore(f(null,0)),false)});
test('bilancio ignora partite estranee e risultati incompleti',()=>{const x=summary([f(4,1),f(1,0,'finished','Alfa','Beta'),f(null,null),f(1,1)],team);assert.deepEqual([x.played,x.wins,x.draws,x.losses,x.gf,x.ga],[2,1,1,0,5,2])});
test('Match Center associato solo se univoco e compatibile',()=>{const fixture=f(null,null,'scheduled','Calcio Caselle','Voltesea');const opp=[{id:'O',name:'Voltesea'}];const op={id:'M',opponent_id:'O',home_away:'home',competition_id:'C',kickoff_at:'2026-09-28T19:20:00Z'};assert.equal(fixtureToMatch(fixture,[op],opp,team)?.id,'M');assert.equal(fixtureToMatch(fixture,[op, {...op,id:'M2'}],opp,team),null)});
test('ruolo e ordinamento deterministici',()=>{assert.equal(roleName('Difensore'),'D');assert.deepEqual(rankRows([{team:'B',points:3,goal_difference:1},{team:'A',points:5,goal_difference:0}]).map(x=>x.team),['A','B']);assert.equal(isLive({status:'scheduled'}),false);assert.equal(isOurs('Calcio Caselle',team),true)});
