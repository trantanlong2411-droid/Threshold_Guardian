export const NETWORK = Object.freeze({
  name: 'Pharos Mainnet', chainId: 1672, mcp: 'https://mcp.pharos.xyz/mcp',
  rpc: 'https://rpc.pharos.xyz', symbol: 'PROS', explorer: 'https://www.pharosscan.xyz'
});
export const DEFAULTS = Object.freeze({
  wallet: '0x51e2A24742Db77604B881d6781Ee16B5b8fcBE29',
  token: '0x51e2A24742Db77604B881d6781Ee16B5b8fcBE29',
  minPros: '0', minToken: '0', maxGasGwei: '100000'
});
export function assertAddress(x, label) {
  if (typeof x !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(x))
    throw new Error(label + ' must be an EVM address (0x plus 40 hexadecimal characters)');
  return x;
}
export function parseUnits(value, decimals, label='threshold') {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) throw new Error('Invalid on-chain decimals');
  const s = String(value);
  if (!/^(?:0|[1-9]\d{0,50})(?:\.\d+)?$/.test(s))
    throw new Error('Invalid ' + label + ': use a non-negative decimal without scientific notation');
  const [whole, fraction=''] = s.split('.');
  if (fraction.length > decimals) throw new Error(label + ' exceeds ' + decimals + ' decimal places');
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, '0') || '0');
}
export function formatUnits(value, decimals) {
  const n = BigInt(value), scale = 10n ** BigInt(decimals);
  const whole = n / scale;
  const fraction = (n % scale).toString().padStart(decimals, '0').replace(/0+$/, '');
  return whole.toString() + (fraction ? '.' + fraction : '');
}
export function validateConfig(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Missing config object');
  const c = {...DEFAULTS, ...value};
  assertAddress(c.wallet,'wallet');
  assertAddress(c.token,'token');
  for (const [key, decimals] of [['minPros',18], ['minToken',18], ['maxGasGwei',9]])
    parseUnits(c[key], decimals, key);
  return c;
}
export function evaluate(snapshot, config) {
  const c = validateConfig(config);
  if (Number(snapshot.chainId) !== NETWORK.chainId) throw new Error('Expected Pharos Mainnet 1672; got ' + snapshot.chainId);
  const decimals = Number(snapshot.decimals);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) throw new Error('Invalid token decimals from chain');
  const vals = {
    prosWei: BigInt(snapshot.prosWei), tokenUnits: BigInt(snapshot.tokenUnits),
    gasWei: BigInt(snapshot.gasWei)
  };
  if (Object.values(vals).some(x=>x<0n)) throw new Error('Negative on-chain value');
  const checks = [
    {id:'native_balance', label:'Native PROS balance', source:'get_balance / eth_getBalance',
      value:formatUnits(vals.prosWei,18), unit:'PROS', operator:'>=', threshold:c.minPros,
      pass:vals.prosWei >= parseUnits(c.minPros,18,'minPros')},
    {id:'token_balance', label:'ERC-20 token balance', source:'eth_call / balanceOf(address)',
      value:formatUnits(vals.tokenUnits,decimals), unit:'token ('+decimals+' decimals)',
      operator:'>=', threshold:c.minToken,
      pass:vals.tokenUnits >= parseUnits(c.minToken,decimals,'minToken')},
    {id:'gas_price', label:'Pharos gas price', source:'get_gas_price / eth_gasPrice',
      value:formatUnits(vals.gasWei,9), unit:'Gwei', operator:'<=', threshold:c.maxGasGwei,
      pass:vals.gasWei <= parseUnits(c.maxGasGwei,9,'maxGasGwei')}
  ];
  return {
    skill:'threshold-guardian', version:'1.0.0', network:NETWORK.name, chainId:NETWORK.chainId,
    blockNumber:String(snapshot.blockNumber), wallet:c.wallet, token:c.token,
    observedAt:new Date().toISOString(), readOnly:true,
    action:'authorize-downstream-action-only',
    decision:checks.every(x=>x.pass)?'FIRE':'HOLD',
    checks, config:{minPros:c.minPros,minToken:c.minToken,maxGasGwei:c.maxGasGwei},
    raw:{prosWei:vals.prosWei.toString(),tokenUnits:vals.tokenUnits.toString(),
      gasWei:vals.gasWei.toString(),decimals}
  };
}
// These demo thresholds are generated from real chain values; no fixed fake chain state.
export function makeFireConfig(c) {
  return {...validateConfig(c), minPros:'0', minToken:'0', maxGasGwei:'1000000000'};
}
export function makeHoldConfig(c, observed) {
  return {...validateConfig(c), minPros:formatUnits(BigInt(observed.prosWei)+10n**18n,18),
    minToken:'0', maxGasGwei:'1000000000'};
}
