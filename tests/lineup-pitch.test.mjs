import test from 'node:test';import assert from 'node:assert/strict';import {pitchPositions,pitchMarkup} from '../fresh/lineup-pitch.js';
test('11 posizioni per moduli validi',()=>{for(const f of ['4-4-2','4-3-3','3-5-2','4-2-3-1']){const p=pitchPositions(f);assert.equal(p.length,11);assert.deepEqual(p.map(x=>x.slot),[1,2,3,4,5,6,7,8,9,10,11]);assert.ok(p.every(x=>x.x>0&&x.x<100&&x.y>0&&x.y<100))}});
test('fallback grafico e slot accessibili',()=>{assert.equal(pitchPositions('4-5-9').length,11);assert.equal((pitchMarkup().match(/data-pitch-slot=/g)||[]).length,11)});
