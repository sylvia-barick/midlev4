# Final Privacy Model Specification

This document details the final privacy classification rules, ZK witness bindings, and commitment parameters of **Confidential Splits**.

---

## 1. Privacy Boundaries & Data Classifications

| Data Field | Classification | Storage Location | Rationale / Boundary |
| :--- | :--- | :--- | :--- |
| **Running Balances** | **PRIVATE** | Client Memory / DApp State | Individual participant balances represent sensitive financial history and are kept client-side. |
| **Blinding Salts** | **PRIVATE** | Client Memory / DApp State | Cryptographic random 32-byte salts prevent brute-force commitment tracking. |
| **ZK Witness Key** | **PRIVATE** | Client Memory / DApp State | Secret key witness ($sk$) derived from wallet address, used to assert membership in ZK proofs. |
| **Balance Commitments**| **PUBLIC** | On-Chain Ledger State | Double-blind hashes $\text{Commitment} = \text{hash}(\text{Balance}, \text{Salt})$ are posted publicly to anchor ZK transitions. |
| **Group ID / Info** | **PUBLIC** | On-Chain Ledger State | Identification metadata used to reference contract records. |
| **Membership Slots** | **PUBLIC** | On-Chain Ledger State | Disclosed ZK public keys stored in the `members` vector (unjoined slots remain padded). |
| **Pending Metadata** | **PUBLIC** | On-Chain Ledger State | Pending expense amounts, split shares, and payment routing indexes are visible during active transaction phases. |

---

## 2. Cryptographic Commitments

Balances are committed publicly on the ledger using the Poseidon/SHA cryptographic hash. 
Because blinding salts are 32-byte cryptographically secure random values:
1. Two identical net balances (e.g. $0n$ and $0n$) generate completely different balance commitments.
2. Observing transaction updates on-chain does not leak whether a participant has a positive or negative balance or how much they split.
3. Commitments are updated client-side after proving correctness, ensuring the contract ledger only transition commitments without viewing balances.
