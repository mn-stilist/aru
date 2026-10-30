// Run: node docs/test-shop-tryon.cjs
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {stripTypeScriptTypes} = require('node:module');
const html = fs.readFileSync('app/index.html','utf8');
for (const [,script] of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(script);
const server = fs.readFileSync('supabase/functions/aru-ai/index.ts','utf8');
stripTypeScriptTypes(server); // Parse the complete deployed source.
const block=html.slice(html.indexOf('function photoBlock('),html.indexOf('function customBlock('));
const start=html.indexOf('  aiphoto:async');
const action=html.slice(start,html.indexOf('  aicustom:',start));
const ctx=vm.createContext({state:{sub:{tryons_left:5},ref:{look:{small:'preview',hi:'PHOTO'},hair:{small:'hair',hi:'HAIR'}},refNote:{look:'only blue jacket'}},t:k=>k,ic:()=>'',esc:x=>x,tryTools:()=>'',render:()=>{},toast:()=>{},why:x=>x});
vm.runInContext(block+'\nvar actions={'+action+'};',ctx);
assert.match(vm.runInContext("photoBlock('look')",ctx),/shop_sub/);
assert.match(vm.runInContext("photoBlock('look')",ctx),/shop_limit/);
assert.doesNotMatch(vm.runInContext("photoBlock('hair')",ctx),/shop_sub|photomode/);
let sent;
ctx.aiApi=async (action,payload)=>{sent=payload;return {ok:false,reason:'test'};};
(async()=>{
  await ctx.actions.aiphoto('look');
  assert.equal(sent.photo_mode,'garment');assert.equal(sent.ref,'PHOTO');assert.equal(sent.text,'only blue jacket');
  ctx.state.photoMode='style';
  assert.match(vm.runInContext("photoBlock('look')",ctx),/byphoto_look_sub/);
  await ctx.actions.aiphoto('look');assert.equal(sent.photo_mode,'style');
  await ctx.actions.aiphoto('hair');assert.equal(sent.photo_mode,undefined);assert.equal(sent.ref,'HAIR');
  ctx.state.aiBusy='look:photo';sent=null;await ctx.actions.aiphoto('look');assert.equal(sent,null);
  const prompts=server.slice(server.indexOf('const REF_RULE'),server.indexOf('function photoHairPrompt'));
  vm.runInContext(stripTypeScriptTypes(prompts),ctx);
  ctx.FACE_RULE='KEEP CLIENT IDENTITY. ';
  const prompt=vm.runInContext("shopItemPrompt('only blue jacket',2)",ctx);
  assert.match(prompt,/Do NOT recolour/);assert.match(prompt,/only blue jacket/);assert.match(prompt,/Keep her body proportions/);
  assert.doesNotMatch(prompt,/closest colour from her palette/);
  console.log('PASS: scripts parse; product/style/hair render and request routing; duplicate-submit guard; product preservation prompt.');
})().catch(e=>{console.error(e);process.exitCode=1;});
