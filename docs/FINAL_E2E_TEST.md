# Final E2E Test Results

This document registers the real on-chain transaction verification status of the dynamic membership splits E2E testing run.

**Status: BLOCKED, not complete.** A real attempt was made against live Preprod and root-caused to a reproducible hang in the installed Midnight wallet SDK — see [`docs/PREPROD_E2E_STATUS.md`](./PREPROD_E2E_STATUS.md) for full evidence. No step below has produced a confirmed transaction.

| Step | Wallet | Transaction | Status |
| :--- | :--- | :--- | :--- |
| **Create Group** | Wallet A | Deployment | BLOCKED |
| **Join Group** | Wallet B | join_group | BLOCKED |
| **Post Expense** | Wallet A | post_expense | BLOCKED |
| **Sync Balance** | Wallet A | sync_balance | BLOCKED |
| **Sync Balance** | Wallet B | sync_balance | BLOCKED |
| **Pay Settlement** | Actual Debtor | post_payment | BLOCKED |
| **Claim Payment** | Actual Creditor | claim_payment | BLOCKED |
