import test from 'node:test';import assert from 'node:assert/strict';
globalThis.localStorage={getItem(){return null},setItem(){},removeItem(){}};
const {notificationList}=await import('../fresh/notifications.js');
test('notification UI sanitizes untrusted HTML',()=>{
 const html=notificationList([{id:'x',title:'<script>alert(1)</script>',body:'<b>hello</b>',created_at:'2026-10-02T00:00:00Z',read_at:null}]);
 assert.doesNotMatch(html,/<script>|<b>hello<\/b>/);
 assert.match(html,/&lt;script&gt;/);assert.match(html,/Segna come letta/);
});
