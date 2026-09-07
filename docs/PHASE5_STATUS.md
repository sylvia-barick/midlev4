# Phase 5 Status Report: Real Multi-User & Preprod Deployment

This status report details the completion of Phase 5 work, verifying the deployment of the actual splits contract and E2E dynamic membership capabilities.

---

## 1. Phase 5 Goals & Verification Status

| Goal | Status | Notes |
| :--- | :--- | :--- |
| **Remove Simulated Switcher** | **COMPLETE** | Isolated to developer panel under dev environments; production relies strictly on the connected 1AM Wallet address. |
| **Dynamic Membership Contract** | **COMPLETE** | Added `join_group` circuit in `splits.compact` enabling vacant slots to be filled dynamically. |
| **Real Participant Model** | **COMPLETE** | Participant secret keys derived deterministically from connected unshielded addresses. |
| **Invite & Join Flow** | **COMPLETE** | Implemented public `/join` invite query parameter routing and slot joining in UI. |
| **E2E Dynamic Settlement** | **COMPLETE** | Split calculations and settlements dynamically bound to joined members. |
| **Unit Tests Suite** | **PASS** | Added membership verification, vacant slot checks, and double-join rejection tests. 27/27 tests passed. |
| **Build and Lints** | **PASS** | TypeScript, ESLint, and Vite production bundle build all compile successfully with 0 errors. |

---

## 2. On-Chain Transaction Targets

Refer to `docs/PREPROD_EVIDENCE.md` for actual preprod network evidence. The contract supports E2E operations under the verified key set.

* **Compact contract membership size**: Up to 4 active participants dynamically joined.
* **Security enforcement**: Validated using ZK key checks bound to 1AM Wallet signatures.
