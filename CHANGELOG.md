# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0-preprod] - 2026-08-15

### Added
* **Midnight Network & Preprod Support**: Integrated DApp API provider with Midnight ledger nodes, pub/sub indexer streams, and local ZK proof generation.
* **1AM Wallet Extension Integration**: Authorized transactions and wallet connection strictly through the injected `window.midnight["1am"]` API connector.
* **Confidential balance commitments**: Balance values are securely blinded with 32-byte salts and updated using zero-knowledge proofs.
* **ZK Proof Circuits**: Compiled circuits for `post_expense`, `sync_balance`, `post_payment`, and `claim_payment` in Compact smart contract.
* **Dynamic Group Membership**: Added on-chain membership vector where empty slots are vacant, and new participants can join dynamically via the `join_group` circuit.
* **Invite System**: Implemented invite link query parameter parsing (`/?join=<contractAddress>`) to automatically connect and display dynamic slots.
* **Settlement Engine**: Locally calculates greedy minimum-cash-flow simplified debts dynamically from active joined members.
* **Security & Privacy Audits**: Completed full validation reviews, confirming no private balances, witnesses, salts, or credentials leak on-chain or inside query parameters.
* **Anti-Mock Audit**: Excluded developer diagnostics simulation switcher from production builds.

### Changed
* Frozen implementation for final multi-wallet Preprod E2E verification.

### Status
* **Real Preprod E2E Verification**: PENDING (Waiting for final wallet synchronizations)
