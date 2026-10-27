import {NETWORK,DEFAULTS,validateConfig,evaluate,makeFireConfig,makeHoldConfig} from './core.mjs';

// Stateless per-request Streamable HTTP MCP client; no keys or browser-side RPC.
class HostedPharosMcp {
  constructor(endpoint=NETWORK.mcp){this.endpoint=endpoint;this.session=null;this.nextId=1;}
  async post(payload){
    const headers={'content-type':'application/json','accept':'application/json, text/event-stream','mcp-protocol-version':'2025-03-26'};
    if(this.session)headers['mcp-session-id']=this.session;
    const response=await fetch(this.endpoint,{method:'POST',headers,body:JSON.stringify(payload),signal:AbortSignal.timeout(16000)});
    const session=response.headers.get('mcp-session-id');
    if(session)this.session=session;
    const body=await response.text();
    if(!response.ok)throw new Error('Pharos MCP HTTP '+response.status+': '+body.slice(0,300));
    if(payload.id===undefined)return null;
    const type=response.headers.get('content-type')||'';
    let parsed;
    if(type.includes('text/event-stream')){
      const frames=body.replace(/\r/g,'').split('\n\n');
      for(const frame of frames){
        const data=frame.split('\n').filter(x=>x.startsWith('data:')).map(x=>x.slice(5).trim()).join('\n');
        if(!data||data==='[DONE]')continue;
        try {const value=JSON.parse(data);if(value.id===payload.id){parsed=value;break;}}catch{}
      }
    }else{try{parsed=JSON.parse(body)}catch{throw new Error('Pharos MCP returned non-JSON response');}}
    if(!parsed)throw new Error('No matching MCP response to '+payload.method);
    if(parsed.error)throw new Error('MCP error: '+JSON.stringify(parsed.error).slice(0,300));
    return parsed.result;
  }
  async connect(){
    await this.post({jsonrpc:'2.0',id:this.nextId++,method:'initialize',
      params:{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'threshold-guardian-worker',version:'1.0.0'}}});
    await this.post({jsonrpc:'2.0',method:'notifications/initialized'});
  }
  async tool(name,args={}){
    const r=await this.post({jsonrpc:'2.0',id:this.nextId++,method:'tools/call',params:{name,arguments:args}});
    if(r?.isError)throw new Error(name+' MCP tool failed: '+JSON.stringify(r.content).slice(0,400));
    const raw=r?.content?.find(x=>x.type==='text')?.text;
    if(!raw)throw new Error('Missing result from '+name);
    let obj;try{obj=JSON.parse(raw)}catch{throw new Error('Invalid JSON from '+name)}
    if(obj.error)throw new Error(name+' RPC error: '+JSON.stringify(obj.error).slice(0,400));
    return obj;
  }
}
async function readOnChain(c){
  const mcp=new HostedPharosMcp();
  await mcp.connect();
  const info=await mcp.tool('get_chain_info');
  if(Number(info.chainId)!==1672||info.chainIdMatches!==true)throw new Error('Pharos Mainnet chain validation failed');
  const height=await mcp.tool('get_block_number');
  if(!/^\d+$/.test(String(height.blockNumber)))throw new Error('Invalid Pharos block number');
  const block=height.blockNumberHex || '0x'+BigInt(height.blockNumber).toString(16);
  const [native,gas,bal,dec]=await Promise.all([
    mcp.tool('get_balance',{address:c.wallet,block}),
    mcp.tool('get_gas_price'),
    mcp.tool('eth_call',{transaction:{to:c.token,data:'0x70a08231'+c.wallet.slice(2).toLowerCase().padStart(64,'0')},block}),
    mcp.tool('eth_call',{transaction:{to:c.token,data:'0x313ce567'},block})
  ]);
  return {chainId:Number(info.chainId),blockNumber:String(height.blockNumber),
    prosWei:String(BigInt(native.balanceWei)),gasWei:String(BigInt(gas.gasPriceWei)),
    tokenUnits:String(BigInt(bal.result)),decimals:Number(BigInt(dec.result))};
}
const HTML=String.raw`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Threshold Guardian · Pharos MCP</title>
<style>
:root{color-scheme:dark;--bg:#0b1020;--panel:#151d32;--text:#e8efff;--muted:#9eabc7;--line:#303c59;--blue:#668bff}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 15% 0%,#182653 0%,var(--bg) 55%);color:var(--text);font:15px/1.55 Inter,ui-sans-serif,system-ui,sans-serif}
main{max-width:1000px;margin:0 auto;padding:48px 18px 100px}header{display:flex;justify-content:space-between;gap:15px;align-items:center;flex-wrap:wrap}
a{color:#a8beff}.tag{font-size:11px;letter-spacing:.15em;color:#aabfff;text-transform:uppercase}
h1{font-size:clamp(34px,6vw,61px);line-height:1.1;letter-spacing:-.055em;margin:24px 0 14px}
.lead{font-size:17px;color:var(--muted);max-width:720px;margin:0 0 30px}.panel{background:rgba(21,29,50,.92);border:1px solid var(--line);border-radius:20px;padding:26px;margin:20px 0;box-shadow:0 15px 40px #05091555}
h2{margin:0 0 15px;font-size:21px}h3{font-size:15px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
label{display:block;color:var(--muted);font-size:12px;margin-bottom:7px;letter-spacing:.03em}
input{width:100%;border:1px solid #425070;background:#0b1328;color:#fff;padding:12px;border-radius:9px;font:inherit}
input:focus{outline:2px solid #6d92ff}button{border:0;border-radius:10px;background:var(--blue);color:#071028;padding:12px 17px;font-weight:700;cursor:pointer}
button.secondary{background:#2a3a5c;color:#e1ebff}button:hover{filter:brightness(1.09)}button:disabled{opacity:.55;cursor:wait}
.controls{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px}.note,.small{font-size:12px;color:var(--muted)}
#status{margin:15px 0 0;color:#bfd0ff;min-height:22px}.decision{font-size:26px;font-weight:800;letter-spacing:.04em}
.fire{color:#51e5a5}.hold{color:#ffcc72}.error{color:#ff8899}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:11px 8px;border-bottom:1px solid var(--line);word-break:break-word}
th{font-size:11px;color:var(--muted);text-transform:uppercase}pre{max-height:420px;overflow:auto;background:#081023;border:1px solid var(--line);padding:16px;border-radius:12px;font-size:12px}
footer{font-size:12px;color:var(--muted)}.hide{display:none}@media(max-width:680px){.grid{grid-template-columns:1fr}main{padding-top:26px}.panel{padding:18px}table{font-size:12px}}
</style></head><body>
<main><header><span class="tag">PHAROS · AGENT ARENA</span><a href="https://github.com/trantanlong2411-droid/Threshold_Guardian" rel="noopener">View source and live CI proof</a></header>
<h1>THRESHOLD<br>GUARDIAN</h1>
<p class="lead">One decision. Three independent on-chain conditions. All must pass before a read-only FIRE authorization signal is given.</p>
<div class="panel">
<h2>Configurable conditions</h2>
<form id="config"><div class="grid">
<div><label for="wallet">Pharos EVM address</label><input id="wallet" value="0x51e2A24742Db77604B881d6781Ee16B5b8fcBE29" required></div>
<div><label for="token">ERC-20 token contract</label><input id="token" value="0x51e2A24742Db77604B881d6781Ee16B5b8fcBE29" required></div>
<div><label for="minPros">Native balance at least (PROS)</label><input id="minPros" value="0" required></div>
<div><label for="minToken">Token balance at least (tokens)</label><input id="minToken" value="0" required></div>
<div><label for="maxGasGwei">Gas price no more than (Gwei)</label><input id="maxGasGwei" value="100000" required></div>
</div><div class="controls">
<button type="button" data-mode="manual">Run configured thresholds</button>
<button type="button" class="secondary" data-mode="fire">Demonstrate FIRE</button>
<button type="button" class="secondary" data-mode="hold">Demonstrate HOLD</button>
</div></form><p class="note">The demo modes derive thresholds from real observations; they never substitute fake chain values. FIRE is not a transaction. The sample address is a public contract, not your wallet.</p>
<div id="status" role="status" aria-live="polite"></div></div>
<section id="result" class="panel hide"><div class="tag">Live on-chain decision trace</div><p id="decision" class="decision"></p>
<p id="meta" class="small"></p><table><thead><tr><th>Condition / source</th><th>Observed</th><th>Rule</th><th>Result</th></tr></thead><tbody id="checks"></tbody></table>
<h3>Verifiable JSON trace</h3><pre id="json"></pre></section>
<footer>Pharos Mainnet · Chain ID 1672 · Official MCP endpoint · Read only. External provider failures produce ERROR, never FIRE.</footer>
</main><script>
const form=document.getElementById('config'),status=document.getElementById('status');
const result=document.getElementById('result'),decision=document.getElementById('decision');
for(const button of form.querySelectorAll('button'))button.addEventListener('click',async()=>{
 const mode=button.dataset.mode;
 const config=Object.fromEntries(['wallet','token','minPros','minToken','maxGasGwei'].map(k=>[k,document.getElementById(k).value.trim()]));
 status.textContent='Reading live Pharos MCP data…';
 result.classList.add('hide');for(const b of form.querySelectorAll('button'))b.disabled=true;
 try{
  const response=await fetch('/api/evaluate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode,config})});
  const report=await response.json();
  if(!response.ok||!report.ok)throw new Error(report.error||'Unexpected provider error');
  const data=report.report;result.classList.remove('hide');
  decision.textContent=data.decision;decision.className='decision '+data.decision.toLowerCase();
  document.getElementById('meta').textContent='Chain '+data.chainId+' · Block '+data.blockNumber+' · '+data.observedAt+' · '+data.mode.toUpperCase()+' mode';
  const tbody=document.getElementById('checks');tbody.replaceChildren();
  for(const check of data.checks){
   const tr=document.createElement('tr');
   for(const item of [check.label+' / '+check.source,check.value+' '+check.unit,check.operator+' '+check.threshold,check.pass?'PASS':'FAIL']){
    const td=document.createElement('td');td.textContent=item;tr.appendChild(td);
   }tbody.appendChild(tr);
  }
  document.getElementById('json').textContent=JSON.stringify(data,null,2);
  status.textContent='Completed from official Pharos MCP. No transaction sent.';
 }catch(error){status.textContent='ERROR / no FIRE: '+error.message;}
 finally{for(const b of form.querySelectorAll('button'))b.disabled=false;}
});
</script></body></html>`;
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});}
export default {
  async fetch(request) {
    const url=new URL(request.url);
    if(request.method==='GET' && url.pathname==='/')
      return new Response(HTML,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
    if(request.method==='GET' && url.pathname==='/api/health')
      return json({ok:true,service:'threshold-guardian',chainId:1672,network:'Pharos Mainnet',liveChainChecked:false});
    if(request.method!=='POST'||url.pathname!=='/api/evaluate')return json({error:'Not found'},404);
    if(Number(request.headers.get('content-length')||0)>5000)return json({ok:false,error:'Request too large'},413);
    let config,mode;
    try{
      const input=await request.json();mode=input.mode||'manual';
      if(!['manual','fire','hold'].includes(mode))throw new Error('Invalid evaluation mode');
      config=validateConfig(input.config);
    }catch(err){return json({ok:false,decision:'ERROR',error:'Invalid input: '+err.message},400);}
    try{
      const snapshot=await readOnChain(config);
      const runConfig=mode==='fire'?makeFireConfig(config):mode==='hold'?makeHoldConfig(config,snapshot):config;
      const report={...evaluate(snapshot,runConfig),source:'Official Pharos MCP',endpoint:NETWORK.mcp,mode,derivedDemoThresholds:mode!=='manual'};
      return json({ok:true,report});
    }catch(err){return json({ok:false,decision:'ERROR',error:'On-chain read failed: '+err.message},502);}
  }
};
