import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeName,isFinished,scoreText,matchResult,computeTeamSummary} from '../src/domain.js';
const ours=name=>normalizeName(name).startsWith('calciocaselle');
const fixture=(home_score,away_score,status='finished',home_team='Calcio Caselle',away_team='Avversaria')=>({home_score,away_score,status,home_team,away_team,kickoff_at:'2026-09-26T19:30:00Z'});
test('0 a 0 è risultato valido, diverso da punteggio mancante',()=>{
 assert.equal(scoreText(fixture(0,0)), '0 : 0');
 assert.equal(scoreText(fixture(null,null)),'VS');
 assert.equal(matchResult(fixture(0,0),ours),'d');
 assert.equal(matchResult(fixture(2,null),ours),null);
});
test('una fixture avversaria non entra nelle statistiche squadra',()=>{
 const data=[fixture(3,1),fixture(4,0,'finished','Alfa','Beta'),fixture(1,2,'finished','Beta','Calcio Caselle')];
 assert.deepEqual((({w,d,l,played,gf,ga})=>({w,d,l,played,gf,ga}))(computeTeamSummary(data,ours)),{w:2,d:0,l:0,played:2,gf:5,ga:2});
});
test('partite senza risultato e programmate non producono statistiche',()=>{
 const data=[fixture(null,null),fixture(2,1,'scheduled'),fixture(3,1,'finished')];
 assert.equal(computeTeamSummary(data,ours).played,1);
 assert.equal(computeTeamSummary(data,ours).done.length,2);
});
test('stato conclusa, nomi, ordine aggregati',()=>{
 assert.equal(isFinished({status:'finished'}),true);
 assert.equal(isFinished({status:'scheduled'}),false);
 assert.equal(normalizeName("Calcio Caselle '08"),'calciocaselle08');
});
