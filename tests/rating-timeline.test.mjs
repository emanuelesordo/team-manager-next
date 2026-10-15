import test from 'node:test';import assert from 'node:assert/strict';import {ratingTimeline} from '../fresh/rating-timeline.js';
test('renders date logos ratings and mean while excluding SV',()=>{
 const rows=[{kickoff_at:'2026-10-01T20:00:00Z',opponent:'Rubano',logo:'https://example.com/a.png',rating:7.5},{kickoff_at:'2026-10-08T20:00:00Z',opponent:'Pianiga',rating:null},{kickoff_at:'2026-10-11T20:00:00Z',opponent:'Caselle',rating:6.5}];
 const html=ratingTimeline(rows,{title:'Rating medio squadra'});
 assert.match(html,/Rubano/);assert.match(html,/img src="https:\/\/example.com\/a.png"/);
 assert.match(html,/Rating medio squadra/);assert.match(html,/7,5/);assert.match(html,/6,5/);assert.match(html,/SV/);assert.match(html,/7<\/b>/);
 assert.match(html,/2 gare valutate/);
});
test('no fabricated ratings and escape HTML',()=>{assert.match(ratingTimeline([{kickoff_at:'2026-10-01',rating:null}]),/Nessuna valutazione/);assert.doesNotMatch(ratingTimeline([{kickoff_at:'2026-10-01',rating:7,opponent:'<img>'}]),/<img>/)});
