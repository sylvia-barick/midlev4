# Confidential Splits Data & Privacy Model

This document outlines the classification (Public, Private, or Derived) of every field in the Confidential Splits domain and specifies where it is stored.

---

## 1. Domain Data Classifications

| Entity | Field | Classification | Rationale | Storage Location |
| :--- | :--- | :--- | :--- | :--- |
| **Group** | Group ID | **PUBLIC** | Used to locate and reference the group on-chain. | Ledger State |
| | Participants | **PUBLIC** | List of ZK public keys in the group (empty slots padded). | Ledger State |
| | Status | **PUBLIC** | Indicates if the group is active or settled. | Ledger State |
| **Participant**| Wallet Address | **PUBLIC** | Public address of connected 1AM Wallet. | Client Wallet |
| | ZK Public Key | **PUBLIC** | Public identifier verified in ZK circuit. | Ledger State (members) |
| | Private Key / Seed | **PRIVATE** | Sensitive key used to generate ZK witnesses, derived deterministically. | Client Wallet / Memory |
| | Secret Salt | **PRIVATE** | Blinding factor used to secure commitment hashes. | Client Private State |
| **Expense** | Payer | **PUBLIC** | Payer address must be known to credit their balance. | Ledger (Pending Expense) |
| | Total Amount | **PUBLIC** | Required to verify the zero-sum conservation constraint. | Ledger (Pending Expense) |
| | Split Shares | **PUBLIC** | Net shares for each user to adjust commitments. | Ledger (Pending Expense) |
| | Timestamp | **PUBLIC** | Used for ordering and auditing ledger transactions. | Ledger State |
| **Balance** | Private Net Balance| **PRIVATE** | The actual net amount a participant owes or is owed. | Client Private State / ZK Witness |
| | Balance Commitment | **PUBLIC** | Hash of private balance + salt; validates state without leaking value. | Ledger State |
| **Settlement** | Debtor Index | **PUBLIC** | The participant sending the settlement payment. | Ledger (Pending Settlement) |
| | Creditor Index | **PUBLIC** | The participant receiving the settlement payment. | Ledger (Pending Settlement) |
| | Payment Amount | **PUBLIC** | Public value of the settlement transaction. | Ledger (Pending Settlement) |
| | Simplified Debts | **DERIVED** | Output of client-side minimum-cash-flow algorithm. | Client Transient State |
| **Membership** | Join Index | **PUBLIC** | Index specifying which group slot is being joined. | Circuit Input |

---

## 2. Privacy Guarantees
* **Shielded Data**: Private balances and private financial state are protected by commitments and ZK state transitions.
* **Public Data**: Specified group and pending settlement metadata remains public to enable verifiable trust and verification of the settlement graph.
* **Proving & Verification**: ZK circuits verify that the private balance was updated exactly by the public split share, without exposing the old or new private balance values.
