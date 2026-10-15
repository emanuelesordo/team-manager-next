import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCallupMessage} from '../fresh/callup-message.js';
const names=['Boschetto','Cabassa','Casadei','Chiodo','Costa','Gagliuolo','Giraldin','Grisolia','Lopez','Lovino','Marcato','Paccagnella','Panaite','Pellegrino','Peruzzo','Polettini','Toffanin','Trevisan','Vanzato','Zanetti'];
const players=names.map((last_name,i)=>({id:String(i+1),first_name:i===0?'Andrea':'Luca',last_name}));
const message=`Elenco convocati per la partita di lunedì contro Union Rubano, con ritrovo alle ore 20.15 in spogliatoio al campo di via Pirandello:

 Boschetto
 Cabassa
 Casadei
 Chiodo
 Costa
 Gagliuolo
 Giraldin
 Grisolia
 Lopez
 Lovino
 Marcato
 Paccagnella
 Panaite
 Pellegrino
 Peruzzo
 Polettini
 Toffanin
 Trevisan
 Vanzato
 Zanetti

Giocheremo con maglia gialla
Se c’è qualcuno che vuol fare il guardalinee mi scriva in privato
Vamos dc`;
test('extracts all 20 surnames while ignoring header and closing',()=>{
 const result=parseCallupMessage(message,players);
 assert.equal(result.error,null);
 assert.equal(result.matched.length,20);
 assert.deepEqual(result.unknown,[]);
 assert.deepEqual(result.ambiguous,[]);
});
test('supports an initial and case-insensitive surname',()=>{
 const result=parseCallupMessage('Intro\n\nA. BOSCHETTO\nCabassa\n\nFine',players);
 assert.deepEqual(result.matched.map(x=>x.id),['1','2']);
});
test('never chooses between duplicate surnames',()=>{
 const roster=[...players,{id:'21',first_name:'Marco',last_name:'Boschetto'}];
 const result=parseCallupMessage('Intro\n\nBoschetto\nCabassa\n\nFine',roster);
 assert.ok(result.ambiguous.includes('Boschetto'));
});
test('flags unknown names and duplicate entries rather than silently excluding',()=>{
 const result=parseCallupMessage('Intro\n\nBoschetto\nCabassa\nSconosciuto\nBoschetto\n\nFine',players);
 assert.deepEqual(result.unknown,['Sconosciuto']);
 assert.deepEqual(result.ambiguous,['Boschetto (duplicato)']);
});
