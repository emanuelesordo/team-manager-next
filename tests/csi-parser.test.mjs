import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
import {parseCsiMatch,validateCsiUrl,fetchCsiHtml,assertFixtureIdentity} from '../supabase/functions/_shared/csi-parser.js';
import {validatePayload} from '../supabase/functions/_shared/csi-payload.js';
const base=new URL('../tools/csi-scraper/tests/fixtures/',import.meta.url);
for(const name of ['PC11BD12','PC11BD3','PC11BD20'])test('Python parser parity: '+name,()=>{
 const html=readFileSync(new URL(name+'.html',base),'utf8');
 const expected=JSON.parse(readFileSync(new URL(name+'.json',base),'utf8'));
 assert.deepEqual(parseCsiMatch(parseHTML(html).document),expected);
});
test('unplayed scores and absent player numbers remain null, never zero',()=>{
 const raw=JSON.parse(readFileSync(new URL('PC11BD20.json',base),'utf8'));
 const result=validatePayload(raw);assert.equal(result.home.score,null);assert.equal(result.away.score,null);
 assert.equal(validatePayload({...raw,events:[{type:'yellow_card',player:{name:'A',number:null}}]}).events[0].player.number,null);
});
test('host allowlist, credentials, ports, redirects and unsupported paths',async()=>{
 const good='https://live.centrosportivoitaliano.it/26/Calcio-a-11/Veneto/Padova/PC11BD12/?j=abc';
 assert.equal(validateCsiUrl(good),good);
 for(const url of ['http://live.centrosportivoitaliano.it/','https://evil.example/','https://user@live.centrosportivoitaliano.it/','https://live.centrosportivoitaliano.it:8080/','https://live.centrosportivoitaliano.it/'])assert.throws(()=>validateCsiUrl(url));
 await assert.rejects(fetchCsiHtml(good,async()=>new Response(null,{status:302,headers:{location:'http://127.0.0.1'}})));
 await assert.rejects(fetchCsiHtml(good,async()=>new Response('no',{status:503})));
});
test('wrong page or identity rejected',()=>{
 assert.throws(()=>parseCsiMatch(parseHTML('<html>captcha</html>').document));
 const raw=JSON.parse(readFileSync(new URL('PC11BD12.json',base),'utf8'));
 const f={match_code:raw.code,home_team:raw.home.name,away_team:raw.away.name};
 assert.doesNotThrow(()=>assertFixtureIdentity(f,raw));
 assert.throws(()=>assertFixtureIdentity({...f,match_code:'other'},raw));
 assert.throws(()=>assertFixtureIdentity({...f,home_team:'other'},raw));
});
test('competition half length controls second-half minutes',()=>{
 const html=readFileSync(new URL('PC11BD12.html',base),'utf8');
 const parsed=parseCsiMatch(parseHTML(html).document,null,45);
 assert.equal(parsed.events.find(e=>e.type==='goal').minute,49);
});
