# Real Multi-User Group Membership Model

This document explains the architecture, security guarantees, and flows of the dynamic group membership system implemented in **Confidential Splits**.

---

## 1. Overview & Architecture

The application implements a real-world multi-user model where a group is created by an initial user (the Creator) and joined dynamically by other users using their own independent browser sessions and **1AM Wallets**.

```
Creator (User 0)              Participant 1 (User 1)          Participant 2 (User 2)
  [Connect Wallet]               [Open Invite Link]              [Open Invite Link]
         │                               │                               │
  [Create Group]                 [Connect Wallet]                [Connect Wallet]
         │                               │                               │
  Deploys Contract               [Join Vacant Slot 1]            [Join Vacant Slot 2]
  [Owner, EMPTY, EMPTY, EMPTY]           │                               │
         │                               ▼                               ▼
         └─────────────────────────► [Owner, User 1, EMPTY] ────────► [Owner, User 1, User 2]
```

### Key Architectural Rules:
1. **Single-Wallet Connection**: The active role of any user is strictly derived from the currently connected 1AM Wallet.
2. **Deterministic Witness Derivation**: The ZK private witness (disclosed secret key) is derived deterministically by hashing the connected unshielded wallet address using SHA-256:
   $$\text{ZKSecretKey} = \text{SHA256}(\text{WalletAddress})$$
   $$\text{ZKPublicKey} = \text{Splits.publicKey}(\text{ZKSecretKey})$$
   This binds a user's ZK identity directly to their connected wallet.
3. **Wallet Key Privacy**: **The application does not access, derive, or expose the user's seed phrase or wallet private key.** Ledger transaction authorization and signatures are managed strictly by the connected **1AM Wallet/connector API**.
4. **No Mocks in Production**: The production UI has no concept of simulated users. The user's role is computed dynamically by scanning the ledger `members` array for their derived ZK public key.

---

## 2. Membership Lifecycle & State

The `splits.compact` contract maintains a fixed-size vector of 4 slots to represent group members:
```compact
export ledger members: Vector<4, Bytes<32>>;
```

### Initial State (Group Creation)
When a group is created by User 0, only their ZK public key is written to slot 0. The remaining slots are initialized to the empty zero-hash `pad(32, "")`:
$$\text{members} = [\text{CreatorPK}, \text{EMPTY}, \text{EMPTY}, \text{EMPTY}]$$

### Invite Mechanism
Upon group creation, the creator can copy and share a public **Invite Link** in the following format:
```
http://localhost:5173/?join=<contractAddress>
```
> [!IMPORTANT]
> The invite link contains **only** the contract address. It never contains private keys, blinding salts, seeds, or other sensitive client-side data.

### Joining the Group
When a new user opens the invite link:
1. They connect their 1AM Wallet to fetch their address.
2. The UI scans the ledger `members` and displays vacant slots (`EMPTY`).
3. The user clicks **Join Slot** next to a vacant index `i` (where $i \in \{1, 2, 3\}$).
4. The DApp executes the ZK `join_group` circuit, replacing the empty value at index `i` with the user's ZK public key on-chain.
5. The user's browser updates their local private state with their derived ZK secret key for slot `i`.

---

## 3. Dynamic Operations

### 3.1. Expense Splits
When a member posts an expense, the split amount is calculated equally **only among active joined members**:
$$\text{Share} = \frac{\text{Amount}}{\text{ActiveMemberCount}}$$
Members in vacant slots get $0$ shares, ensuring they are unaffected by the expense. The sum of all shares equals the total expense amount, satisfying the contract's zero-sum conservation rule.

### 3.2. Settlement calculations
The settlement optimizer operates strictly on participants who have actually joined and have non-zero private net balances. Nonexistent users are ignored (their balances remain $0n$).

---

## 4. Security Guarantees
* **Authorized Signatures**: Every ledger-modifying operation (expenses, syncing, payments, claims, joining) must be signed and approved by the connected 1AM Wallet.
* **Asserted Callers**: The ZK circuits verify that the caller's private ZK secret key witness matches the public key recorded in the contract's `members` array for that index. Non-members cannot act as other members or post transactions on their behalf.
* **Double-Join Protection**: The `join_group` circuit asserts that a public key cannot join the group twice, preventing a single wallet from occupying multiple slots.
