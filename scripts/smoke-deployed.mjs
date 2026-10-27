import assert from 'node:assert/strict';
const base = process.env.GUARDIAN_BASE_URL || 'https://threshold-guardian.trantanlong2411.workers.dev';
const wallet='0x51e2A24742Db77604B881d6781Ee16B5b8fcBE29';
const config={wallet,token:wallet,minPros:'0',minToken:'0',maxGasGwei:'100000'};
async function req(path, init={}) {
  const res=await fetch(base+path,{...init,signal:AbortSignal.timeout(35000)});
  const text=await res.text();
  if(!res.ok) throw new Error(path+' HTTP '+res.status+': '+text.slice(0,800));
  return {res,text};
}
async function main(){
  const {text:healthText}=await req('/api/health');
  const health=JSON.parse(healthText);
  assert.equal(health.ok,true);
  assert.equal(health.chainId,1672);
  console.log('Health endpoint: OK, expected Pharos chain 1672');
  const {text:html}=await req('/');
  assert.match(html,/THRESHOLD/);
  assert.match(html,/GUARDIAN/);
  console.log('Public homepage: OK');
  for(const mode of ['fire','hold']){
    const {text}=await req('/api/evaluate',{method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({mode,config})});
    const response=JSON.parse(text);
    assert.equal(response.ok,true,'Actual deployed Worker MCP call must succeed');
    const r=response.report;
    assert.equal(r.source,'Official Pharos MCP');
    assert.equal(r.chainId,1672);
    assert.equal(r.mode,mode);
    assert.equal(r.readOnly,true);
    assert.equal(r.decision,mode.toUpperCase());
    assert.equal(r.checks.length,3);
    assert.deepEqual(r.checks.map(x=>x.id),['native_balance','token_balance','gas_price']);
    assert.equal(r.checks.every(x=>x.pass),mode==='fire');
    assert.equal(r.derivedDemoThresholds,true);
    console.log(JSON.stringify({
      check:'Public deployed Worker live MCP', mode, network:r.network,
      blockNumber:r.blockNumber, observedAt:r.observedAt,
      decision:r.decision, checks:r.checks
    },null,2));
  }
}
main().catch(e=>{console.error('DEPLOYED SMOKE FAILED: '+e.message);process.exitCode=1;});
