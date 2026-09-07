# Final Architecture Document

This document defines the E2E architecture flow, compiled circuits, and settlement mechanics of the **Confidential Splits** DApp.

---

## 1. System Integration Flow

```
  [User Action] ──► [1AM Wallet] ──► [DApp Connector] ──► [ZK Proof Provider] 
                                                                  │
  [DApp State] ◄── [Indexer Stream] ◄── [Midnight Preprod] ◄──────┘
```

1. **User Action**: Interacts with the React browser interface.
2. **1AM Wallet**: Injected browser connector providing unshielded addresses and signing payloads.
3. **DApp Connector**: Manages active connection interfaces.
4. **ZK Proof Provider**: Combines public inputs and private witnesses to compile proofs using local proof server keys.
5. **Compact Circuit**: Contract circuits compile into Zero-Knowledge IR (ZKIR).
6. **Midnight Preprod**: Nodes receive proven proofs and write validated state updates on-chain.
7. **Splits Contract**: On-chain smart contract containing ledger commitments, member public keys, and status flags.
8. **Indexer**: Pub/Sub GraphQL subscription stream monitoring contract ledger states.
9. **DApp State**: Dynamic client states update on screen automatically.

---

## 2. Core Compact Circuits

The contract compiles five primary ZK proof circuits:
1. **`join_group(idx)`**: Guest users disclose their public key from their private ZK secret key witness and write it to vacant ledger indexes.
2. **`post_expense(payer_idx, amount, shares)`**: Validates that the payer's witness matches the selected index, asserts that splits sum exactly to the expense amount, and logs split share details.
3. **`sync_balance(idx, old_balance, old_salt, new_salt)`**: Validates caller slot, verifies previous commitment validity, updates balance with the split share, and registers the new balance commitment on-chain.
4. **`post_payment(debtor_idx, creditor_idx, amount, old_balance, old_salt, new_salt)`**: Asserts caller matches the debtor slot, registers payment routing parameters, and updates the debtor's balance commitment.
5. **`claim_payment(old_balance, old_salt, new_salt)`**: Asserts caller matches the creditor slot, validates payment routing records, and updates the creditor's balance commitment.

---

## 3. Settlement Algorithm

The **Settlement Optimizer** runs a local deterministic greedy cash flow simplification:
* **Inputs**: The engine reads the array of synced private net balances from the active members list.
* **Simplification Math**:
  1. Identifies the maximum debtor (most negative balance) and maximum creditor (most positive balance).
  2. Resolves the settlement payment amount:
     $$\text{Amount} = \min(|B_{\text{debtor}}|, B_{\text{creditor}})$$
  3. Updates transient balances and logs the simplified debt routing.
  4. Repeats recursively until all balances converge to zero.
* **Boundary**: This is classified as **LOCAL DETERMINISTIC COMPUTATION**; it simplifies debts client-side, but requires executing real on-chain `post_payment` circuits to commit financial settlements.
