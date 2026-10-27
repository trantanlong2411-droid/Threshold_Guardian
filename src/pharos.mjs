import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {NETWORK} from './core.mjs';
export function decode(result, name) {
  if (result?.isError) throw new Error(name + ': ' + JSON.stringify(result.content));
  const raw = result?.content?.find(x=>x.type==='text')?.text;
  if (!raw) throw new Error(name + ': missing MCP text response');
  let data;
  try { data=JSON.parse(raw); } catch {throw new Error(name + ': invalid MCP JSON response');}
  if (data?.error) throw new Error(name + ': ' + JSON.stringify(data.error));
  return data;
}
export async function withPharosClient(fn) {
  const client = new Client({name:'pharos-threshold-guardian',version:'1.0.0'});
  const transport = new StreamableHTTPClientTransport(new URL(process.env.PHAROS_MCP_URL || NETWORK.mcp));
  try {await client.connect(transport); return await fn(client);} finally {await client.close();}
}
export async function readSnapshot(client, c) {
  const call = async (name,args={})=>decode(await client.callTool({name,arguments:args}),name);
  const info = await call('get_chain_info');
  if (Number(info.chainId)!==NETWORK.chainId || info.chainIdMatches!==true)
    throw new Error('Chain verification failed: expected Pharos Mainnet 1672; got '+info.chainId);
  const latest = await call('get_block_number');
  const blockNumber = String(latest.blockNumber);
  if (!/^\d+$/.test(blockNumber)) throw new Error('Invalid block number');
  const block = latest.blockNumberHex || '0x'+BigInt(blockNumber).toString(16);
  const [native,gas,tokenBal,tokenDec] = await Promise.all([
    call('get_balance',{address:c.wallet,block}),
    call('get_gas_price'),
    call('eth_call',{transaction:{to:c.token,data:'0x70a08231'+c.wallet.slice(2).toLowerCase().padStart(64,'0')},block}),
    call('eth_call',{transaction:{to:c.token,data:'0x313ce567'},block})
  ]);
  const decimals = Number(BigInt(tokenDec.result));
  return {
    chainId:Number(info.chainId),blockNumber,prosWei:String(BigInt(native.balanceWei)),
    gasWei:String(BigInt(gas.gasPriceWei)),tokenUnits:String(BigInt(tokenBal.result)),decimals
  };
}
