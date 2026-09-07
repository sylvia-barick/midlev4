# Release Readiness Audit Report

This document reports the final verification audit conducted on the **Confidential Splits** release candidate package.

---

## 1. Release Candidate Audit Findings

Every major vector in the repository has been checked and categorized:

| Target | Finding | Category | Action / Resolution |
| :--- | :--- | :--- | :--- |
| **`contract/src/splits.compact`** | Fully verified circuit logic and constraints. | **SAFE** | Retained as production contract. |
| **`bboard-ui/src/App.tsx`** | Contains developer switcher panel under `import.meta.env.DEV`. | **DEV ONLY** | Gated correctly. Panel does not compile in production. |
| **`contract/src/test/splits.test.ts`** | Contains simulation tests and mock key targets. | **TEST ONLY** | Excluded from build targets. |
| **`.env.example`** | Network endpoints for Preprod testnet. | **DOCUMENTATION** | Retained. Contains **0** secrets. |
| **`bboard-ui/public/keys/`** | Copied ZK prover and verifier keys. | **SAFE** | Served statically for proof compilation. |

---

## 2. Environment & Network Configuration

* **Release Tag / Target**: `v1.0.0-preprod`
* **Target Network**: **Midnight Preprod Testnet** (Not mainnet)
* **Configuration Gating**: Endpoint settings are loaded from environment configurations:
  * Network ID: `preprod`
  * RPC: `https://rpc.preprod.midnight.network`
  * Indexer: `https://indexer.preprod.midnight.network/api/v4/graphql`
* **Secrets Management**: Verification checks confirmed that **0 private keys, seeds, mnemonics, or credentials** are bundled into build artifacts or committed to git.

---

## 3. Transaction Lifecycle States

The DApp tracks blockchain transaction stages using a strict state machine. No transaction transitions to `CONFIRMED` without receiving verification from the Preprod indexer:

```
  [IDLE] ──► [PREPARING] ──► [PROVING] ──► [AWAITING_WALLET] ──► [SUBMITTED] ──► [CONFIRMED]
                                                                        │
                                                                        └──► [FAILED / REJECTED]
```

* **PREPARING**: Constructing public inputs and fetching ledger states.
* **PROVING**: Local WASM proof generator compiles ZK proof.
* **AWAITING_WALLET**: Requesting connector signature/approval via 1AM.
* **SUBMITTED**: Transaction submitted to Preprod ledger nodes.
* **CONFIRMED**: Transaction verified and indexed on-chain.
