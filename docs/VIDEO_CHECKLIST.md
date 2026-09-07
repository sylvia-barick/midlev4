# E2E Demo Video Timeline Checklist

Use this checklist to record the 3-5 minute E2E walkthrough video:

* **0:00 - Problem Explanation**: Explain the privacy leakages in existing public ledger split systems.
* **0:30 - Privacy Solution**: Introduce Confidential Splits' blind balance commitments and ZK proofs.
* **1:00 - Wallet Connection**: Connect Wallet A via 1AM.
* **1:20 - Create Group**: Enter a name, deploy the contract, and show that only Wallet A is recorded on-chain.
* **1:45 - Copy Invite**: Click copy invite link.
* **2:00 - Dynamic Join**: Open the invite URL, connect Wallet B, and click join slot on Slot 1.
* **2:30 - Post Expense**: Post a 1200 tNight expense split equally (600 each).
* **3:00 - ZK Sync Private Balance**: Run sync balance transitions on both member tabs to update ZK commitments.
* **3:30 - Settle Simplified Debt**: View optimized settlement routing.
* **4:00 - Settle Payment & Claim**: Debtor executes `post_payment` and creditor pulls funds via `claim_payment`.
* **4:30 - Privacy Verification**: Verify that the public ledger records only commitments and pending transaction updates, not running balances.
* **5:00 - Final Result**: Show the fully settled state.
