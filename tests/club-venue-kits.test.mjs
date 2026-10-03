import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseFixtureVenue,fixtureVenueDetails,formatClubAddress} from '../fresh/venue-format.js';
import {defaultKits,normalizeKit,isKitColor,shirtSvg} from '../fresh/kit-editor.js';
const staff=readFileSync(new URL('../fresh/staff-ui.js',import.meta.url),'utf8');
const api=readFileSync(new URL('../fresh/api.js',import.meta.url),'utf8');
const main=readFileSync(new URL('../fresh/main.js',import.meta.url),'utf8');
const cases=[
 ['Stadio Pianiga Viale Giulio Onesti 1 - 30030 Pianiga Ve (C11BD14)','Stadio Pianiga','Viale Giulio Onesti 1','Pianiga','VE'],
 ['Impianto Sportivo Flavio Mengato Via Pirandello 1 - 35030 Caselle di Selvazzano Dentro Pd (C11BD23)','Impianto Sportivo Flavio Mengato','Via Pirandello 1','Caselle di Selvazzano Dentro','PD'],
 ['Campo Armistizio Via Armistizio 279 - 35142 Padova Pd (C11BD7)','Campo Armistizio','Via Armistizio 279','Padova','PD'],
 ['Impianto Sportivo Comunale di Bronzola Via S. Francesco - 35011 Campodarsego Pd (C11BD19)','Impianto Sportivo Comunale di Bronzola','Via S. Francesco','Campodarsego','PD'],
 ['Campo Cavinese Airone Via Della Rimembranza - 35010 San Giorgio Delle Pertiche Pd (C11BD18)','Campo Cavinese Airone','Via Della Rimembranza','San Giorgio Delle Pertiche','PD'],
 ['Campo San Sebastian Via Cimitero, 1a - 30036 Santa Maria di Sala Ve (C11BD16)','Campo San Sebastian','Via Cimitero, 1a','Santa Maria di Sala','VE'],
 ['Campo Comunale Via Trieste 24 - 35010 Santa Giustina in Colle Pd (C11BD17)','Campo Comunale','Via Trieste 24','Santa Giustina in Colle','PD'],
 ['Impianti Scalabrin Via Luigi Dottesio 3 - 35138 Padova Pd (C11BD22)','Impianti Scalabrin','Via Luigi Dottesio 3','Padova','PD'],
 ['Campo Comunale Stigliano “Sergio Righetto” Via Fracasso 12 - 30036 Santa Maria di Sala Ve (C11BD10)','Campo Comunale Stigliano “Sergio Righetto”','Via Fracasso 12','Santa Maria di Sala','VE'],
 ['Stadio Comunale Campodoro Via Lissaro 50 - 35010 Campodoro Pd (C11BD15)','Stadio Comunale Campodoro','Via Lissaro 50','Campodoro','PD'],
 ['Campo Fratte Rondinelle Via Europa 15 - 35010 Santa Giustina in Colle Pd (C11BD20)','Campo Fratte Rondinelle','Via Europa 15','Santa Giustina in Colle','PD'],
 ['Campo Sintetico A. Zanin Via Borromeo 35 - 35030 Rubano Pd (C11BD35)','Campo Sintetico A. Zanin','Via Borromeo 35','Rubano','PD'],
 ['Polisportiva Sacra Famiglia Padova Via Perugia, 3, - 35142 Padova Pd (C11BD9)','Polisportiva Sacra Famiglia Padova','Via Perugia, 3','Padova','PD']
];
test('all 13 current fixture-venue formats omit codes/CAP and retain exact field, street and locality',()=>{
 for(const [input,name,street,city,province] of cases){
  const output=parseFixtureVenue(input);
  assert.deepEqual(output,{name,street,city,province},input);
  assert.doesNotMatch(JSON.stringify(output),/\d{5}|C11BD/);
 }
});
test('single-game alternative field always overrides registered default',()=>{
 const club={home_venue_name:'Impianti Scalabrin',home_venue_street:'Via Luigi Dottesio 3',home_venue_city:'Padova',home_venue_province:'PD'};
 const fixture={venue:'C.S. San Paolo Via Canestrini, 72 - 35127 Padova Pd (C11BD11)'};
 assert.deepEqual(fixtureVenueDetails(fixture,club),{name:'C.S. San Paolo',address:'Via Canestrini, 72, Padova (PD)'});
 assert.deepEqual(fixtureVenueDetails({},club),{name:'Impianti Scalabrin',address:'Via Luigi Dottesio 3, Padova (PD)'});
});
test('team and opponents have editable name, street, municipality, province fields and kit controls',()=>{
 for(const key of ['home_venue_name','home_venue_street','home_venue_city','home_venue_province']){
  assert.equal((staff.match(new RegExp("input\\('"+key+"'","g"))||[]).length,2);
  assert.match(api,new RegExp(key));
 }
 assert.equal((staff.match(/btn\('configure-kits','Configura maglie'\)/g)||[]).length,2);
 assert.match(staff,/openKitConfigurator\(club,async kits/);
 assert.match(staff,/adminWrite\(own\?'teams':'app_opponents','PATCH',payload,\{id:club\.id\}\)/);
});
test('home, away, keeper kit styles and color palettes are independent',()=>{
 const c={kit_style:'solid',kit_primary_color:'#ABCDEF',kit_secondary_color:'#ff0000',kit_number_color:'#101010'};
 const start=defaultKits(c);
 assert.equal(start.home.primary,'#ABCDEF');
 assert.equal(start.home.secondary,'#ff0000');
 assert.equal(start.home.number,'#101010');
 assert.notEqual(start.away.primary,start.goalkeeper.primary);
 assert.ok(isKitColor('#aabbcc'));
 assert.equal(isKitColor('url(javascript:evil)'),false);
 assert.equal(normalizeKit({style:'unknown',primary:'bad'}).style,'stripes');
 for(const style of ['solid','stripes','hoops','halves','diagonal']){
  const output=shirtSvg({...start.home,style},'preview-'+style,true);
  assert.match(output,/role="img"/);
  assert.match(output,/clipPath/);
  assert.match(output,/>10<\/text>/);
  assert.doesNotMatch(output,/javascript:|undefined/);
 }
});
test('calendar and match header use cleaned fixture venues without guessing club identity by name',()=>{
 assert.match(main,/fixtureVenueDetails\(f,fixtureHomeClub\(f\)\)/);
 assert.match(main,/f\?\.home_team_id===team\(\)\?\.id/);
 assert.match(main,/o\.id===f\?\.home_opponent_id/);
});
