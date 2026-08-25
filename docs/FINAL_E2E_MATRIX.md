# Final E2E Test Matrix

This matrix tracks the execution status and transaction references of the real Preprod network E2E test.

**Status: PARTIALLY VERIFIED, still BLOCKED overall.** Deployment is confirmed on real Preprod. Every other step is BLOCKED. See [`docs/PREPROD_E2E_STATUS.md`](./PREPROD_E2E_STATUS.md) for the full investigation, real attempted-run evidence, and root cause (a reproducible hang in the installed Midnight wallet SDK's dust-wallet sync, confirmed with this repo's own pre-existing scripts too).

| Operation | Wallet | Real Tx Hash | Confirmed | Evidence Status |
| :--- | :--- | :--- | :--- | :--- |
| **Deployment** | Wallet A (Creator) | `3cffa9d76a160c27c7d6f8299fbe3d2a3d3cb7b47382107cfd9c8804b1b55f66` | **YES** (block 2,119,943) | **VERIFIED** — see PREPROD_E2E_STATUS.md §2 |
| **join_group** | Wallet B (Member 1) | BLOCKED | BLOCKED | BLOCKED |
| **post_expense** | Wallet A (Payer) | BLOCKED | BLOCKED | BLOCKED |
| **sync_balance** | Wallet A | BLOCKED | BLOCKED | BLOCKED |
| **sync_balance** | Wallet B | BLOCKED | BLOCKED | BLOCKED |
| **post_payment** | Wallet B (Debtor) | BLOCKED | BLOCKED | BLOCKED |
| **claim_payment**| Wallet A (Creditor) | BLOCKED | BLOCKED | BLOCKED |
