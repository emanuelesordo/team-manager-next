import test from 'node:test';import assert from 'node:assert/strict';
import{matchRoute,parseMatchRoute}from'../fresh/match-route.js';
const id='bb86b6c8-e0f1-4ec1-8dd8-4e35c55f3139';
test('deep link partita ripristinabile dopo refresh',()=>{assert.equal(matchRoute(id),'#match/'+id);assert.equal(parseMatchRoute(matchRoute(id)),id)});
test('hash sconosciuti non aprono una partita',()=>{for(const h of ['#match','#match/../../evil','#match/fail','#home',''])assert.equal(parseMatchRoute(h),null);assert.throws(()=>matchRoute('fake'))});
