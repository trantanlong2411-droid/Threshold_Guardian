#!/usr/bin/env node
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {validateConfig,evaluate,makeFireConfig,makeHoldConfig,NETWORK} from '../src/core.mjs';
import {withPharosClient,readSnapshot} from '../src/pharos.mjs';
const args=process.argv.slice(2);
const arg=(flag,defaultValue)=>{const i=args.indexOf(flag);if(i<0)return defaultValue;if(!args[i+1]||args[i+1].startsWith('--'))throw new Error('Missing value for '+flag);return args[i+1];};
async function main(){
  if(args.includes('--help')) {
    console.log('node bin/guardian.mjs --mode manual|fire|hold --config config.json --out proof/fire.json');
    console.log('manual: evaluate your thresholds; fire/hold: choose scenario thresholds using LIVE observed state');
    return;
  }
  const config=validateConfig(JSON.parse(await readFile(arg('--config','config.json'),'utf8')));
  const mode=arg('--mode','manual');
  if(!['manual','fire','hold'].includes(mode))throw new Error('Unknown mode: '+mode);
  const report=await withPharosClient(async client=>{
    const snapshot=await readSnapshot(client,config);
    const c=mode==='fire'?makeFireConfig(config):mode==='hold'?makeHoldConfig(config,snapshot):config;
    const result=evaluate(snapshot,c);
    if((mode==='fire'&&result.decision!=='FIRE')||(mode==='hold'&&result.decision!=='HOLD'))
      throw new Error('On-chain demo unexpectedly failed to yield '+mode.toUpperCase());
    return {...result,source:'Official Pharos MCP',endpoint:process.env.PHAROS_MCP_URL || NETWORK.mcp,
      mode,derivedDemoThresholds:mode!=='manual'};
  });
  const payload=JSON.stringify(report,null,2)+'\n';
  console.log(payload);
  const output=arg('--out',null);
  if(output){await mkdir(dirname(output),{recursive:true});await writeFile(output,payload);console.error('Evidence saved: '+output);}
}
main().catch(err=>{console.error('ERROR - NO FIRE: '+err.message);process.exitCode=1;});
