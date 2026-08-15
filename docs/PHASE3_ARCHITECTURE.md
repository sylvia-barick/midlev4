# Phase 3 - Confidential Splits Architecture

This document describes the design architecture, component reuse, and privacy boundaries for the **Confidential Splits** dApp.

---

## 1. Reusable Components from Phase 2
We will reuse the entire verified local Midnight test environment:
* **Proof Server Integration**: The local proof server running on port `6300` will handle zero-knowledge proof generation for all circuits.
* **1AM Wallet Adapter**: The injection detection logic (`window.midnight['1am']`) and the `.connect('preprod')` sequence.
* **Network RPC & Indexer Configuration**: Preprod endpoints for querying ledger state and pushing transactions.

---

## 2. Components to be Modified
* **UI App Component (`bboard-ui/src/App.tsx`)**: Will be modified to present the group management, expense creation, balance syncing, and settlement views rather than the bulletin board checker.
* **Service Provider Setup (`BrowserDeployedBoardManager.ts`)**: We will adapt it to initialize providers using the compiled `splits` contract instead of the test `bboard` contract.

---

## 3. Components to be Created
* **Compact Contract (`contract/src/splits.compact`)**: The smart contract containing group definitions, zero-sum checking circuit, and witness balance commitment updates.
* **Settlement Engine (`contract/src/settlement.ts`)**: Deterministic TypeScript implementation of the minimum-cash-flow simplified debt settlement algorithm.
* **Unit and Integration Tests**: Comprehensive tests for both the contract simulator and the settlement algorithm.

---

## 4. Privacy Boundaries
* **Public Information**:
  * Participant address lists (`members`).
  * Group identifiers.
  * Ledger-level commitments of individual net balances.
  * Pending expense amounts and split shares.
* **Private Information**:
  * Individual actual net balances (witness inputs).
  * Private key material / witnesses.
  * Random salts used for commitment blinding.
  * Expense history and personal transactions.

---

## 5. Data Flow
1. Payer posts a split expense to the public ledger: `post_expense(amount, shares)`.
2. Each participant privately syncs their share using their old balance and salt as ZK witnesses: `sync_balance(old_balance, old_salt, new_salt)`.
3. The new balance commitments are published on-chain.
4. Simplified settlement transactions are generated client-side using the synced private net balances.
5. Debtor and creditor clear their balances on the ledger via `settle_debt` ZK transactions.
