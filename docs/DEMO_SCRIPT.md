# E2E Demo Script

This demo walk-through demonstrates the privacy-preserving dynamic membership and expense settlement capabilities of **Confidential Splits** on Midnight Preprod in 3-5 minutes.

---

## 1. Introduction (0 - 45s)
* **Goal**: Explain the problem and network parameters.
* **Script**:
  > "Confidential Splits is a privacy-preserving group expense tracker built on the Midnight Preprod testnet. While traditional split apps leak all running balances and payments to a public ledger, Confidential Splits keeps individual net balances and blinding salts securely private on-chain using zero-knowledge commitments."

---

## 2. Wallet Connection & Group Creation (45s - 1m 30s)
* **Goal**: Deploy the contract and verify the creator is the only initial member.
* **Steps**:
  1. Open the home page and click **Connect 1AM Wallet**.
  2. Approve the connection. Wallet address `Wallet A` resolves.
  3. Enter a group name (e.g. `Preprod Expenses`) and click **CREATE GROUP**.
  4. Approve the deployment in the wallet popup.
  5. Once confirmed, copy the contract address.
  * **Observation**: Notice the UI shows `Members: 1 / 4`. Only Wallet A is recorded; the remaining slots 1-3 display as vacant.

---

## 3. Invite & Dynamic Join (1m 30s - 2m 15s)
* **Goal**: Open the invite URL with Wallet B and dynamically join the contract slot.
* **Steps**:
  1. Click **Copy Invite Link** (`http://localhost:5173/?join=<contractAddress>`).
  2. Open the invite link in a separate browser profile or window.
  3. Switch your 1AM extension to Wallet B and click **Connect**.
  4. The guest view resolves Slot 0 as occupied and Slot 1-3 as vacant. Click **Join Slot** next to Slot 1.
  5. Approve the transaction.
  * **Observation**: Once indexed, the DApp updates the members list to show `Members: 2 / 4`, displaying both Wallet A and Wallet B addresses.

---

## 4. Post Expense & ZK Balance Sync (2m 15s - 3m)
* **Goal**: Post a group expense split equally among active members, then sync balances.
* **Steps**:
  1. Go back to Wallet A's window, enter `1200` in the amount field, select Wallet A as the payer, and click **POST SPLIT EXPENSE**. Approve the transaction.
  2. **Equal Splits**: The settlement engine divides the amount equally only among active members (600 tNight each).
  3. Switch to both Wallet A and Wallet B tabs, and click **Sync Private Balance** on each to update their client-side private commitments in ZK.

---

## 5. Settlement Payment & Claim (3m - 4m)
* **Goal**: Execute the settlement payment from the debtor and claim it as the creditor.
* **Steps**:
  1. Wallet B (debtor) sees an optimized settlement owing 600 tNight to Wallet A. Click **Pay Settlement** and sign the transaction.
  2. Once confirmed, Wallet A (creditor) clicks **Claim Payment** to pull the funds on-chain.
  3. **Verification**: The payment status clears, updating the private balances securely without disclosing details publicly.
