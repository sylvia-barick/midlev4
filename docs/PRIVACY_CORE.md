# Privacy Core Specification

This document details the privacy architecture, division of responsibilities, and ZK proof mechanics in **Confidential Splits**.

---

## 1. Allocation of Responsibilities

### Client-Side DApp Responsibility
* **Secret Storage**: Keeps track of the participant's secret key ($sk$) and random salts ($S$).
* **Private State Tracking**: Stores the current private balance of the participant.
* **Settlement Computation**: Runs the greedy minimum-cash-flow algorithm on decrypted/synced private balances.
* **Witness Generation**: Constructs the parameters for ZK proof generation, including the old balance, old salt, and a newly generated blind salt.
* **Key Derivation**: Derives the private secret key deterministically using SHA-256 on the active 1AM Wallet address.

### Compact Contract Responsibility
* **Membership Validation**: Asserts that only group participants can perform state transitions.
* **Arithmetic Correctness**: Verifies that split allocations sum up exactly to the total expense amount.
* **Commitment Enforcement**: Enforces that balance transition steps match the blind hashes published on the ledger.
* **State Locking**: Locks syncing and settlement steps so they cannot be double-spent or overwritten.
* **Dynamic Join Verification**: Verifies vacant slots and prevents double-joining via the `join_group` circuit.

---

## 2. ZK Proof Generation & Verification
1. **Inputs**:
   * **Private Witnesses**: $B_{\text{old}}$, $S_{\text{old}}$, $S_{\text{new}}$, $sk$.
   * **Public Inputs**: $idx$, $\text{shares}$, $\text{amount}$.
2. **Circuit Verification**:
   * Verifies the caller owns the participant slot by hashing $sk$.
   * Verifies the previous commitment is correct: $\text{Commitment}_{\text{old}} = \text{hash}(B_{\text{old}}, S_{\text{old}})$.
   * Computes the new balance: $B_{\text{new}} = B_{\text{old}} + \text{change}$.
   * Registers the new commitment: $\text{Commitment}_{\text{new}} = \text{hash}(B_{\text{new}}, S_{\text{new}})$.
3. **Verification Output**: The on-chain verifier executes the key check. If valid, the transaction updates the public balance commitment on-chain.

---

## 3. Privacy Boundaries & Limitations
* **Shielded Data**: Private balances and private financial state are protected by commitments and ZK state transitions.
* **Public Metadata**: Specified group and pending settlement metadata remains public on-chain. This includes the list of participant public keys (empty slots are padded with `pad(32, "")`), pending expense amounts, pending split shares, and pending payment routing logs.
