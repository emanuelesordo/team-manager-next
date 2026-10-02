import test from 'node:test';
import assert from 'node:assert/strict';
import {scoredFixtures, scoreSeries, goalsChart, resultMix, splitVenue, scorersChart, rosterDistribution} from '../src/visuals.js';
const ours = s => s === 'Calcio Caselle';
const f = (score, date,home='Calcio Caselle',away='Avversaria',status='finished') => ({home_team:home,away_team:away,kickoff_at:date,status,home_score:score?.[0]??null,away_score:score?.[1]??null});
test('la serie esclude gare altrui, programmate e risultati parziali',()=>{
 const data=[f([2,1],'2026-09-01'),f([7,4],'2026-09-03','Alfa','Beta'),f([0,0],'2026-09-02'),f([5,1],'2026-09-04','Calcio Caselle','Alfa','scheduled'),f(null,'2026-09-05')];
 assert.equal(scoredFixtures(data,ours).length,2);
 assert.deepEqual(scoreSeries(scoredFixtures(data,ours),ours).map(x=>x.gf),[2,0]);
});
test('reti in trasferta non scambiate; nessuna stima',()=>{
 const m=scoredFixtures([f([1,3],'2026-09-01','Alfa','Calcio Caselle')],ours);
 assert.deepEqual([scoreSeries(m,ours)[0].gf,scoreSeries(m,ours)[0].ga],[3,1]);
 assert.match(goalsChart(m,ours), /single-goals/);
 assert.match(goalsChart([...m,f([1,2],'2026-09-02')],ours), /polyline/);
 assert.match(goalsChart([],ours), /non disponibile/);
});
test('l’anello e la comparazione mantengono valori reali',()=>{
 assert.match(resultMix({w:0,d:0,l:0}),/primo risultato/);
 const html=resultMix({w:2,d:1,l:1});assert.match(html,/2 vittorie/);
 const v=splitVenue([f([2,1],'2026-09-01'),f([2,0],'2026-09-02','Alfa','Calcio Caselle')],ours);
 assert.match(v,/1V 0N 0P/);assert.match(v,/0V 0N 1P/);
});
test('marcatori e ruoli evitano valori inventati e escape markup',()=>{
 assert.match(scorersChart([]),/Nessun marcatore/);
 const html=scorersChart([{first_name:'X',last_name:'<script>',goals:2}]);assert.ok(!html.includes('<script>'));
 assert.match(rosterDistribution([{role:'D'},{role:'D'},{role:'P'}]), /Difensori <b>2<\/b>/);
});
