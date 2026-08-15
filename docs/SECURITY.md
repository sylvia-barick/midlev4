# Security & Privacy Audit Report

This report documents the security audit conducted on the **Confidential Splits** smart contract and DApp package, checking for accidental disclosures of private balances, keys, and expense details.

---

## 1. Audit Checklists & Findings

| Audit Vector | Inspected Targets | Risk Rating | Status / Finding |
| :--- | :--- | :--- | :--- |
| **Private Keys & Seed Phrases** | `bboard-ui/src/`, `contract/src/`, environment configurations | **NONE** | No seed phrases, private keys, or wallet credentials are hardcoded or checked into Git. |
| **Console Logs** | `bboard-ui/src/App.tsx`, `contract/src/settlement.ts` | **NONE** | No logging of private participant balances or salts. Only public transaction outputs and network statuses are logged. |
| **Storage Leakage** | `localStorage`, `sessionStorage` usage | **NONE** | No sensitive client-side parameters, ZK salts, or private keys are written to persistent browser storage. |
| **Public Ledger State** | `splits.compact` state fields | **NONE** | Individual actual balances are securely hashed and stored as blind commitments. |
| **Network & API Payloads** | RPC calls, WebSocket sync messages | **NONE** | Data transmission is restricted to public ledger values and ZK proof descriptors. |
| **Membership & Identity** | `join_group` circuit and wallet derivation | **NONE** | Connected wallet unshielded addresses determine ZK keys deterministically, preventing spoofing or local client state bypasses. |

---

## 2. Privacy Safeguards
1. **Blind Commitments**: Balance commitments use a secure 32-byte salt (`new_salt`) for blinding, ensuring that two identical balances produce completely different hashes.
2. **Ephemereal Salt Lifecycle**: Salts are generated client-side and used only as witness parameters. They are not stored in any public indexer database.
3. **ZK Proof Scoping**: Circuits enforce local transaction math within ZK boundaries. No private ledger state is sent to the network.
4. **On-Chain Member Controls**: Vacant slots are filled dynamically and checked in ZK. Caller public key verifications prevent unauthorized posts, payment postings, and claims.
