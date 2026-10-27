# Threshold Guardian — Pharos Agent Arena

**Live deployed website / primary reviewer proof (Git-integrated Worker):** https://threshold-guardian.trantanlong2411.workers.dev/

**Automated public site verification:** https://github.com/trantanlong2411-droid/Threshold_Guardian/actions/workflows/verify.yml

**Repository:** https://github.com/trantanlong2411-droid/Threshold_Guardian


**100-point skill** · Pharos Mainnet · Live Pharos MCP · Three independent on-chain conditions · FIRE / HOLD · Read-only

This skill fetches real Pharos state, evaluates three checks together and emits a reviewer-friendly decision trace. It **does not send transactions**, hold private keys, or claim that demo fixtures are on-chain evidence.

## Conditions (not hardcoded)
| Condition | Official Pharos MCP source | Rule |
| --- | --- | --- |
| Native PROS balance | `get_balance` | native balance >= `minPros` |
| ERC-20 `balanceOf(wallet)` | `eth_call` | token balance >= `minToken` |
| Network gas price | `get_gas_price` | gas price <= `maxGasGwei` |

The `get_chain_info` result MUST confirm mainnet chain ID **1672**. ERC-20 data is pinned to a block read from `get_block_number`. Gas price is read at request time. Missing reads or invalid input produce an **ERROR** and *never* FIRE. All numeric computations use `BigInt`.


## Cloudflare Workers Builds (Git-linked `threshold-guardian` Worker)

This repository is connected to the **Cloudflare Worker named `threshold-guardian`**, which is separate from the older manually deployed `pharos-threshold-guardian` Worker. The checked-in `wrangler.jsonc` intentionally uses `"name": "threshold-guardian"` to match the connected Worker exactly.

**Automatic deployment:** Each push to `main` triggers Cloudflare Workers Builds. In Cloudflare dashboard, open **Workers & Pages → threshold-guardian → Settings → Builds** and verify:

- **Git repository:** `trantanlong2411-droid/Threshold_Guardian`
- **Production branch:** `main`
- **Root directory:** `/`
- **Build command:** leave empty for this pure Worker
- **Deploy command:** `npx wrangler deploy`

Inspect the `Workers Builds: threshold-guardian` GitHub commit check for the actual deployment status. The successful CLI integration and old deployed site do not, by themselves, confirm deployment to the **new** Worker. Find its confirmed production URL under Cloudflare **Domains & Routes**. The new Git-linked Worker has been verified with public HTTP checks for both live **FIRE** and **HOLD**: https://threshold-guardian.trantanlong2411.workers.dev/. The old manually deployed site remains separate at https://pharos-threshold-guardian.trantanlong2411.workers.dev/, and is not the primary submission URL.

## Windows quick start (PowerShell)

```powershell
git clone https://github.com/trantanlong2411-droid/Threshold_Guardian.git
cd Threshold_Guardian
npm.cmd install
npm.cmd test
npm.cmd run run
```

Modify `config.json` to enter a valid Pharos address and ERC-20 contract. The default address is the public LINK token contract used in the earlier Pharos challenge. This is a public read-only sample address, **not your own wallet**. Values are **example thresholds**. Example default thresholds are intentionally permissive; replace them with the rules relevant to your real use case.

## Two live on-chain outcomes

```powershell
npm.cmd run fire
npm.cmd run hold
```

Both commands connect to the official **hosted Pharos MCP** and query a real block, PROS balance, ERC-20 balance and gas. To deterministically demonstrate opposite results without moving funds, demo `fire` uses permissive thresholds and demo `hold` sets `minPros = observed on-chain balance + 1 PROS`. The source observations are real; the demo thresholds are **derived from those values**, clearly labeled `derivedDemoThresholds:true`. No fictitious blockchain data are used.

Result JSON includes the `network`, `blockNumber`, `observedAt`, `wallet`, `token`, exact source values, comparison operators, configurable thresholds, PASS/FAIL for each condition and `FIRE` or `HOLD`. Proof files are written into `proof/fire.json` and `proof/hold.json` when commands succeed. The proof directory is git-ignored.

```powershell
node .\bin\guardian.mjs --mode manual --config config.json --out proof/manual.json
```

`manual` evaluates *your* thresholds without substituting a demo configuration. If the network is unreachable, the program reports an error and deliberately produces no fabricated successful result.

## Reviewer proof and CI

- [GitHub Actions — unit tests AND live hosted Pharos MCP runs](https://github.com/trantanlong2411-droid/Threshold_Guardian/actions/workflows/verify.yml)
- Open the most recent completed workflow run, inspect **unit** plus **live-pharos-mcp** jobs.
- The live job prints two **different actual MCP executions** labeled FIRE and HOLD, with each condition, observation, source and threshold. Download `threshold-guardian-pharos-mcp-evidence` from its artifacts if present.
- `npm test` verifies all comparison rules against clearly marked synthetic snapshots. **Mock/unit tests alone are not live proof.**
- Check that the live job is **green** before claiming success. If unavailable, report the error instead of submitting it as working evidence.
- The repo URL is the optional **Repo link** in the task form; use a public successful workflow run or your deployed Worker URL as **Proof link**.

## Web demo (Cloudflare Workers, optional)

The `src/worker.mjs` web demo implements the same decision logic with a server-side MCP client, so browser users do not need a wallet connection. To publish under your Cloudflare account:

```powershell
npx.cmd wrangler login
npm.cmd run deploy
```

The Git-linked deployment is already available at [https://threshold-guardian.trantanlong2411.workers.dev/](https://threshold-guardian.trantanlong2411.workers.dev/). Use it as **PROOF LINK**. The Worker always reads Pharos state server-side; its authorization signal never broadcasts a transaction.

## Submission notes (English)

> Threshold Guardian is a read-only on-chain decision skill powered by the official Pharos MCP server. It verifies Pharos Mainnet (chain ID 1672), reads three independent live conditions (native PROS balance, ERC-20 balanceOf and network gas price), compares them with configurable thresholds, and emits PASS/FAIL per condition plus a final FIRE or HOLD. Live FIRE/HOLD runs are demonstrated with thresholds derived from real observations; no transactions or private keys are involved. Errors fail closed. GitHub Actions preserves the live logs and JSON evidence.

## Official references

- [Pharos MCP](https://github.com/PharosNetwork/pharos-mcp) — hosted `https://mcp.pharos.xyz/mcp`, chain ID 1672, read-only tools
- [AI.PHAROS](https://ai.pharos.xyz/pharos-mcp)
- [Threshold Guardian task](https://pharos-agent-arena.vercel.app/tasks/threshold-guardian)
