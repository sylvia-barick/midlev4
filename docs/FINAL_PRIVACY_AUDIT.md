# Final Privacy Audit Report

This report outlines the classification of ledger states and verified privacy boundaries in **Confidential Splits**.

---

## 1. Classification Matrix

The application handles data according to a strict privacy boundary classification:

### Public On-Chain Ledger Data
* **Contract Address**: Deployed group identifier.
* **Membership Slots**: Public ZK keys stored in the `members` vector. Note that unjoined slots contain the public default value `pad(32, "")`.
* **Pending Settlement Metadata**: Debtor and creditor indices, transaction amounts, and payment status (`pending_payment_status`) are public on-chain while a settlement is active.
* **Pending Expense Metadata**: Payer index, total expense amount, and the split shares vector (`pending_expense_shares`) are public during the synchronization phase.

### Private Shielded Data
* **Running Balances**: Individual net balances (representing how much each participant owes or is owed) are kept strictly private on client browsers.
* **Blinding Salts**: 32-byte cryptographically secure random salts used to shield balance commitments.
* **Private Witnesses**: ZK witness information (such as ZK secret keys used to verify group membership) remains private on client browsers.
* **Balance Commitments**: Published on-chain as a blind commitment:
  $$\text{Commitment} = \text{hash}(\text{PrivateBalance}, \text{PrivateSalt})$$
  This allows the ledger to verify balance state transitions in ZK without revealing the actual values.

---

## 2. Invite Link Privacy Guarantee

The dynamic invite mechanism generates links in the following format:
```
http://localhost:5173/?join=<contractAddress>
```

An audit of the query parameter handling and URL serialization has verified that:
* **0** private keys or seed phrases are appended.
* **0** running private balance values are appended.
* **0** blinding salts are appended.
* **0** ZK witness variables are appended.

The link contains exclusively the public contract address, which allows guest users to resolve the public ledger members list upon connecting their own wallet.
