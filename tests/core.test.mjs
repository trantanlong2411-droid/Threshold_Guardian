import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS,evaluate,parseUnits,formatUnits,makeFireConfig,makeHoldConfig} from '../src/core.mjs';
import {decode} from '../src/pharos.mjs';
const s={chainId:1672,blockNumber:'20250000',prosWei:'80000000000000000',
  tokenUnits:'1234567',gasWei:'2100000000',decimals:6};
test('FIRE: all three independent chain values pass',()=>{
  const r=evaluate(s,{...DEFAULTS,minPros:'0.05',minToken:'1',maxGasGwei:'3'});
  assert.equal(r.decision,'FIRE');assert.deepEqual(r.checks.map(x=>x.pass),[true,true,true]);
});
test('HOLD: native balance fails',()=>{
  const r=evaluate(s,{...DEFAULTS,minPros:'0.1',minToken:'1',maxGasGwei:'3'});
  assert.equal(r.decision,'HOLD');assert.deepEqual(r.checks.map(x=>x.pass),[false,true,true]);
});
test('HOLD: gas is too expensive',()=>{
  const r=evaluate(s,{...DEFAULTS,minPros:'0',minToken:'0',maxGasGwei:'1'});
  assert.equal(r.decision,'HOLD');assert.equal(r.checks[2].pass,false);
});
test('HOLD: ERC20 token is below threshold',()=>{
  const r=evaluate(s,{...DEFAULTS,minPros:'0',minToken:'100',maxGasGwei:'3'});
  assert.equal(r.decision,'HOLD');assert.equal(r.checks[1].pass,false);
});
test('demo fire and hold thresholds derive from observations',()=>{
  assert.equal(evaluate(s,makeFireConfig(DEFAULTS)).decision,'FIRE');
  assert.equal(evaluate(s,makeHoldConfig(DEFAULTS,s)).decision,'HOLD');
});
test('invalid chain id must fail closed',()=>assert.throws(()=>evaluate({...s,chainId:688689},DEFAULTS),/Pharos/));
test('malformed wallet fails',()=>assert.throws(()=>evaluate(s,{...DEFAULTS,wallet:'0xBAD'}),/EVM address/));
test('invalid decimal precision fails',()=>assert.throws(()=>parseUnits('0.0000000001',9),/exceeds/));
test('BigInt exactness: 18 decimal places',()=>{
  assert.equal(parseUnits('1.000000000000000001',18).toString(),'1000000000000000001');
  assert.equal(formatUnits('1000000000000000001',18),'1.000000000000000001');
});
test('MCP result parsing rejects provider errors',()=>{
  assert.throws(()=>decode({isError:true,content:[{type:'text',text:'RPC failed'}]},'get_balance'),/RPC failed/);
  assert.throws(()=>decode({content:[{type:'text',text:'{"error":"unavailable"}'}]},'get_balance'),/unavailable/);
});
