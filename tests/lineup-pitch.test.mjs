import test from 'node:test';import assert from 'node:assert/strict';import {pitchPositions,pitchMarkup,formationModules,numericSortValue} from '../fresh/lineup-pitch.js';
test('11 posizioni per moduli validi',()=>{for(const f of formationModules){const p=pitchPositions(f);assert.equal(p.length,11);assert.deepEqual(p.map(x=>x.slot),[1,2,3,4,5,6,7,8,9,10,11]);assert.ok(p.every(x=>x.x>0&&x.x<100&&x.y>0&&x.y<100))}});
test('fallback grafico e slot accessibili',()=>{assert.equal(pitchPositions('4-5-9').length,11);assert.equal((pitchMarkup().match(/data-pitch-slot=/g)||[]).length,11)});

test('12 moduli standard univoci e validi',()=>{assert.equal(formationModules.length,12);assert.equal(new Set(formationModules).size,12);for(const f of formationModules)assert.equal(f.split('-').map(Number).reduce((a,b)=>a+b,0),10)});

test('ordinamento numerico: assenti e trattini valgono zero',()=>{for(const value of [null,undefined,'','-','—','non disponibile'])assert.equal(numericSortValue(value),0);assert.equal(numericSortValue('7,5'),7.5)});
