# Phase 6 Final E2E Report

This document records the E2E verification plan, wallet configurations, error handling, and production hardening checks.

---

## 1. Test Setup & Configuration

* **Network**: Midnight Preprod Testnet
* **Wallet Connector**: Injected `window.midnight["1am"]` provider
* **Identities**:
  - **Wallet A**: Group Creator (Slot 0)
  - **Wallet B**: Participant 1 (Slot 1)
  - **Wallet C**: Participant 2 (Slot 2)
  - **Wallet D**: Participant 3 (Slot 3)

---

## 2. Error Handling & Edge Cases

The DApp and contract enforce strict validation, reporting clear status indicators for the following conditions:
* **Wallet Not Installed**: UI displays a clear notification: `"1AM Wallet extension not detected"`.
* **Wallet Disconnected**: All transaction buttons are disabled, prompting the user to connect.
* **Wrong Network**: If the connected wallet network is not `preprod`, the API resolve hook throws an error, prompting the user to switch networks.
* **Wallet Rejection**: Rejections are caught in transaction handlers, resetting the state machine from `AWAITING_WALLET` back to `FAILED` with details: `"Transaction was rejected by the user"`.
* **Proof Failure**: If the ZK proof compiler fails to verify the witness key, it resets state to `FAILED` with verification trace.
* **Insufficient Balance**: Checked on-chain and caught before submit: `"Insufficient tDUST or tNIGHT balance"`.
* **Already Joined**: `join_group` circuit asserts that if the user's ZK public key matches any active member, the transaction fails.
* **Group Full**: If all slots are occupied (i.e. no slot contains the empty hash `pad(32, "")`), the join buttons are disabled.
* **Unauthorized Actions**: Circuits assert caller matches slot index. Unauthorized payers, debtors, or creditors are blocked at the contract level.

---

## 3. Production Hardening Checklist

* **No DEV Simulation Panel**: Gated using `import.meta.env.DEV`. The panel is completely stripped from production build bundles.
* **No Hardcoded Secrets**: Scanned repository; no Mnemonics, private keys, seeds, or confidential salts are present.
* **No Local State Fakes**: Membership displays, payments, claims, and syncs rely strictly on contract state indices returned by the live public indexer.
* **Wallet Signatures**: Signature authorization is strictly delegated to the user's 1AM wallet popup; no mock signatures or state overrides can bypass approval.
