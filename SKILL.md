---
name: pharos-threshold-guardian
description: Evaluate multiple independently sourced on-chain checks using official Pharos MCP; FIRE only if all pass, otherwise HOLD. Read-only, fail-closed, configurable and auditable.
---
# Pharos Threshold Guardian
When a user wants a conditional on-chain action on Pharos:
1. Read `config.json` and configure `wallet`, ERC20 `token`, `minPros`, `minToken`, `maxGasGwei`. Thresholds are decimal strings, never floating-point arithmetic.
2. Use the official hosted Pharos MCP (`https://mcp.pharos.xyz/mcp`). First call `get_chain_info` and verify chain ID **1672**.
3. At a pinned block, call `get_balance` for native PROS, `eth_call` for ERC20 `balanceOf(address)` and `decimals()`. Separately read `get_gas_price`. These are **three independent conditions** (native balance, token balance, gas price).
4. Evaluate each `value operator threshold` and print its on-chain source, observed value, PASS/FAIL, threshold, final FIRE/HOLD.
5. **Only FIRE if every check PASS; otherwise HOLD.** Missing/invalid RPC or chain state is **ERROR / no FIRE**; never fabricate values.
6. FIRE is a read-only **authorization signal**, not a blockchain transaction. Never request secrets or private keys.
7. Reproduce with `npm install`, `npm run run`. For on-chain FIRE + HOLD demonstration: `npm run fire` and `npm run hold`. Demo modes generate thresholds relative to observed on-chain values and say so clearly.
8. Before submitting, check GitHub Actions live job logs; unit tests use simulated fixtures and are not proof of chain connectivity.
