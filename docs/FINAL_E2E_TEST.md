# Final E2E Test Results

This document registers the real on-chain transaction verification status of the dynamic membership splits E2E testing run.

**Status: PARTIALLY VERIFIED, still BLOCKED overall.** Deployment is confirmed on real Preprod (tx `3cffa9d76a160c27c7d6f8299fbe3d2a3d3cb7b47382107cfd9c8804b1b55f66`, block 2,119,943 — independently verified, see [`docs/PREPROD_E2E_STATUS.md`](./PREPROD_E2E_STATUS.md) §2). A real attempt to complete the remaining steps was made against live Preprod and root-caused to a reproducible hang in the installed Midnight wallet SDK — see `PREPROD_E2E_STATUS.md` for full evidence. No step past deployment has produced a confirmed transaction.

| Step | Wallet | Transaction | Status |
| :--- | :--- | :--- | :--- |
| **Create Group** | Wallet A | Deployment | **CONFIRMED** — tx `3cffa9d7...b55f66`, block 2,119,943 |
| **Join Group** | Wallet B | join_group | BLOCKED |
| **Post Expense** | Wallet A | post_expense | BLOCKED |
| **Sync Balance** | Wallet A | sync_balance | BLOCKED |
| **Sync Balance** | Wallet B | sync_balance | BLOCKED |
| **Pay Settlement** | Actual Debtor | post_payment | BLOCKED |
| **Claim Payment** | Actual Creditor | claim_payment | BLOCKED |
