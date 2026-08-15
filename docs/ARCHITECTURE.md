# Confidential Splits Architecture

This document describes the structural topology and cryptographic data flows of the **Confidential Splits** dApp.

---

## 1. System Integration Flow

```mermaid
graph TD
  User("User / Browser") -->|"Approve Tx / Sign"| Wallet("1AM Wallet Extension")
  Wallet -->|"Injected API Connector"| Connector("Midnight DApp Connector")
  Connector -->|"State / Wallet API Hooks"| DApp("React / TypeScript DApp")
  DApp -->|"Invoke Circuit impureCircuits"| Compact("Compact Contract / ZK Circuits")
  Compact -->|"Request ZK Proof"| ProofServer("Proof Generation (Local Server)")
  ProofServer -->|"Submit Proven Transaction"| Preprod("Midnight Preprod Ledger")
```

---

## 2. Data Privacy & Zero-Knowledge Verification Flow

```mermaid
flowchart TD
  subgraph Client [Client-Side Privacy Boundary - PRIVATE]
    Expense["Private Expense Details (Amount, Blinding Salts)"]
    Key["Private Witness Key (sk)"]
    Balance["Private Net Balance (B)"]
    Math["Compute: B_new = B_old + share"]
  end

  subgraph Proof [Zero-Knowledge Proof - SHIELDED]
    Circuit["ZK Circuit Verification"]
    VerifyKey["Verify: hash(sk) == member_pubkey"]
    VerifyCommit["Verify: old_commitment == hash(B_old, S_old)"]
    GenerateProof["Generate Proof of correctness"]
  end

  subgraph Ledger [On-Chain Ledger State - PUBLIC]
    Commitment["On-Chain Blind Commitment (hash(B_new, S_new))"]
    Members["Public Members List"]
    Result["Transaction Settled Result (True/False)"]
  end

  Expense --> Math
  Key --> VerifyKey
  Balance --> VerifyCommit
  Math --> GenerateProof
  
  VerifyKey --> Circuit
  VerifyCommit --> Circuit
  GenerateProof --> Commitment
  Circuit --> Result
  Members --> VerifyKey
```

---

## 3. Dynamic Group Membership Flow

```mermaid
sequenceDiagram
  autonumber
  actor User as Participant 1 (Guest)
  participant UI as Splits DApp
  participant Wallet as 1AM Wallet
  participant Ledger as Midnight Ledger

  User->>UI: Opens Invite Link (?join=contractAddress)
  UI->>Wallet: Requests connection / address
  Wallet-->>UI: Returns unshielded address (mn_addr...)
  UI->>UI: Derives SecretKey = hash(mn_addr)
  UI->>UI: Computes PublicKey = publicKey(SecretKey)
  UI->>UI: Scans ledger members for vacant slot (e.g. index 1)
  User->>UI: Clicks "Join Slot 1"
  UI->>Wallet: Prompts ZK Join Transaction signature
  Wallet-->>UI: Signs tx
  UI->>Ledger: Submits join_group(1) transaction
  Ledger->>Ledger: Asserts members[1] == empty && PK not already joined
  Ledger->>Ledger: Updates members[1] = PublicKey
  Ledger-->>UI: Confirmed!
  UI->>UI: Updates currentUserIdx = 1 (Role: Member)
```
