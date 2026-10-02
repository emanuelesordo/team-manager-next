import test from 'node:test';import assert from 'node:assert/strict';
globalThis.localStorage={getItem(){return null},setItem(){},removeItem(){}};
const m=await import('../fresh/account-ui.js');
test('guest cannot see private profile',()=>{const markup=m.profilePanel({profile:null},'2026/27');assert.match(markup,/necessario autenticarsi/i);assert.doesNotMatch(markup,/data-account-profile/)});
test('first login password modal exported for app lifecycle',()=>{assert.equal(typeof m.showPasswordChange,'function');assert.equal(typeof m.maybeRequirePasswordChange,'function')});
