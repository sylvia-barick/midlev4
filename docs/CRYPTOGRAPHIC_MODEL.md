# Cryptographic Model: Commitments vs. ZK Proofs

This document clarifies the cryptographic distinction between commitments and ZK proofs in the **Confidential Splits** protocol, preventing incorrect terminology and identifying exact verification guarantees.

---

## 1. Cryptographic Commitment
A commitment binds a participant to a specific private value while keeping it hidden from the public.

* **What is Committed?**
  A participant's private net balance ($B$) combined with a random 32-byte secret salt ($S$):
  $$\text{Commitment} = \text{persistentHash}(B, S)$$
* **What does the Commitment Guarantee?**
  * **Binding Property**: The participant cannot change their balance later without changing the commitment hash.
  * **Hiding Property**: External observers cannot determine the balance $B$ from the commitment hash.
* **What Information Remains Hidden?**
  The actual net balance ($B$) and the secret salt ($S$).

---

## 2. Zero-Knowledge Proof (ZK Proof)
A ZK proof mathematically demonstrates that a computation was executed correctly without revealing the inputs.

* **What Statement is Proven?**
  "The new commitment corresponds to the old commitment updated by exactly the public expense share, and the caller knows the secret key associated with the participant address."
* **What is the Private Witness/Input?**
  * Old balance ($B_{\text{old}}$) and old salt ($S_{\text{old}}$).
  * New salt ($S_{\text{new}}$).
  * Participant secret key ($sk$).
* **What can the Verifier Learn?**
  Only that the proof is valid (i.e. the mathematical constraints were satisfied). The verifier learns **nothing** about $B_{\text{old}}$, $S_{\text{old}}$, $S_{\text{new}}$, or $sk$.
* **What does the Proof Verify?**
  * The transition from $\text{Commitment}_{\text{old}}$ to $\text{Commitment}_{\text{new}}$ is mathematically valid:
    $$\text{Commitment}_{\text{old}} = \text{hash}(B_{\text{old}}, S_{\text{old}})$$
    $$B_{\text{new}} = B_{\text{old}} + \text{publicShare}$$
    $$\text{Commitment}_{\text{new}} = \text{hash}(B_{\text{new}}, S_{\text{new}})$$
  * The signature of the state transition matches the participant's key.

---

## 3. Protocol Limitations & Cryptographic Assumptions
* **Proof Generation Boundary**: The ZK proof validates that the state transitions of the local balance are correct. However, if a user's client side behaves maliciously (e.g. they report a wrong balance when initializing the group for the first time), the contract enforces that initial balances must be committed as $0$.
* **Public Inputs**: The public share added to the balance is visible during the execution transaction. To fully obscure the share amount in a production layout, additional shielded transaction mechanisms would be required.
