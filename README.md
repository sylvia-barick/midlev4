# Bulletin Board DApp

This project is built on the [Midnight Network](https://midnight.network/).

[![Generic badge](https://img.shields.io/badge/Compact%20Compiler-0.30.0-1abc9c.svg)](https://shields.io/)
[![Generic badge](https://img.shields.io/badge/TypeScript-5.9.3-blue.svg)](https://shields.io/)
[![CI](https://github.com/sylvia-barick/midlev4/actions/workflows/ci.yaml/badge.svg)](https://github.com/sylvia-barick/midlev4/actions)


> **Use this repo as a template. Do not fork it.**
>  
> This repository is intended to be used via GitHub’s “Use this template” flow.  
> Forking this repo is discouraged, as forks are not tracked as independent projects.

A Midnight smart contract example demonstrating a simple one-item bulletin board with zero-knowledge proofs on testnet. Users can post a single message at a time, and only the message author can remove it.

## Project Structure

```
bulletin-board/
├── contract/               # Smart contract in Compact language
│   └── src/               # Contract source and utilities
├── api/                   # Methods, classes and types for CLI and UI
├── bboard-cli/            # Command-line interface
│   └── src/               # CLI implementation
└── bboard-ui/             # Web browser interface
    └── src/               # Web UI implementation
```

## Prerequisites

### 1. Node.js Version Check

You need Node.js:

```bash
node --version
```

Expected output: `v24.11.1` or higher. The repository includes an [.nvmrc](./.nvmrc) pinned to `24.11.1`.

If you get a lower version: [Install Node.js LTS](https://nodejs.org/).

### 2. Docker Installation

The [proof server](https://docs.midnight.network/develop/tutorial/using/proof-server) runs in Docker and is required for both CLI and UI to generate zero-knowledge proofs:

```bash
docker --version
```

Expected output: `Docker version X.X.X`.

If Docker is not found: [Install Docker Desktop](https://docs.docker.com/desktop/). Make sure Docker Desktop is running.

### 3. Lace Wallet Extension (UI Only)

For the web interface, install the official Lace wallet extension on [Chrome Store](https://chromewebstore.google.com/detail/lace/gafhhkghbfjjkeiendhlofajokpaflmk) or the [Edge Store](https://microsoftedge.microsoft.com/addons/detail/lace/efeiemlfnahiidnjglmehaihacglceia) (tested with version 1.36.0).

After installing, set up the Midnight wallet:

1. Create a **new wallet** — Midnight will appear as a network option
2. Set **Network** to **Preprod**
3. Set **Proof server** to **Local (http://localhost:6300)** — this must point to your local proof server started via Docker
4. Click **Enter Wallet**
5. Fund your wallet with tNIGHT tokens from the [Preprod Faucet](https://midnight-tmnight-preprod.nethermind.dev/)
6. Go to **Tokens** in the wallet, click **Generate tDUST**, and confirm the transaction — tDUST tokens are required to pay transaction fees on preprod

## Setup Instructions

### Install Project Dependencies

```bash
npm install
```

This repository uses npm workspaces. Run installation once from the repository root.

### Compile the Smart Contract

The Compact compiler (`compactc 0.31.0`) generates TypeScript bindings and zero-knowledge circuits from the smart contract source code:

```bash
cd contract
npm run compact    # Compiles the Compact contract
npm run build      # Copies compiled files to dist/
cd ..
```

Expected output:

```
> compact
> compact compile src/bboard.compact ./src/managed/bboard

Compiling 2 circuits:
  circuit "post" (k=14, rows=10070)
  circuit "takeDown" (k=14, rows=10087)

> build
> rm -rf dist && tsc --project tsconfig.build.json && cp -Rf ./src/managed ./dist/managed && cp ./src/bboard.compact ./dist

```

### Build the CLI Interface

```bash
cd bboard-cli
npm run build
cd ..
```

### Build the UI Interface (Optional)

Only needed if you want to use the web interface:

```bash
cd bboard-ui
npm run build
cd ..
```

## Option 1: CLI Interface

### Start the Proof Server

The CLI requires a local proof server running in Docker:

```bash
cd bboard-cli
docker compose -f proof-server-local.yml up -d
```

This uses `midnightntwrk/proof-server:8.0.3` on `http://127.0.0.1:6300`.

### Run the CLI

```bash
# For preprod network
npm run preprod-remote

# For preview network
npm run preview-remote
```

### Using the CLI

#### Create a Wallet

1. Choose option `1` to build a fresh wallet
2. The system will generate a wallet address and seed
3. **Save both the address and seed** - you'll need them later

Expected output is similar to:

```
Your wallet seed is: [64-character hex string]
Using unshielded address: mn_addr_preprod1hdvtst70zfgd8wvh7l8ppp7mcrxnjn56wc5hlxpwflz3fxdykaesrw0ln4 waiting for funds...
```

#### Fund Your Wallet

Before deploying contracts, you need testnet tokens.

1. Copy your wallet address from the output above
2. Visit the [faucet](https://midnight-tmnight-preprod.nethermind.dev/)
3. Paste your address and request funds
4. Wait for the CLI to detect the funds (takes 2-3 minutes)

Expected output after funding is similar to:

```
Your NIGHT wallet balance is: 1000000000
```

#### Deploy Your Contract

1. Choose the contract deployment option
2. Wait for deployment (takes ~30 seconds)
3. **Save the contract address** for future use

Expected output:

```
Deployed bulletin board contract at address: [contract address]
```

#### Use the Bulletin Board

You can now:

- **Post** a message to the bulletin board
- **View** the current message
- **Remove** your message (only if you posted it)
- **Exit** when done

Each action creates a real transaction on Midnight Testnet using zero-knowledge proofs generated by the proof server.

## Option 2: Web UI Interface

The web interface uses the same proof server and requires additional browser setup.

### Start the Proof Server (if not already running)

If you haven't started the proof server for the CLI, start it now:

```bash
cd bboard-cli
docker compose -f proof-server-local.yml up -d
cd ..
```

Verify it's running:

```bash
docker ps
```

### Start the Web Interface

The UI can run against preprod or preview networks:

```bash
cd bboard-ui

# For preprod network
npm run build:start

# For preview network
npm run build:start:preview
```

The UI will be available at:

- http://127.0.0.1:8080

### Browser Setup

1. **Open the UI URL** in a browser with Lace wallet extension installed
2. **Set up Lace wallet** if it's your first time
3. **Authorize the application** when Lace wallet prompts
4. Use the bulletin board web interface

## Useful Links

- Get Testnet tNIGHT on [Preprod Faucet](https://midnight-tmnight-preprod.nethermind.dev/) or [Preview Faucet](https://midnight-tmnight-preview.nethermind.dev/)
- [Midnight Documentation](https://docs.midnight.network/examples/dapps/bboard) - Complete developer guide
- [Compatibility Matrix](https://docs.midnight.network/relnotes/support-matrix) - Current supported Midnight component versions
- [Compact Language Guide](https://docs.midnight.network/compact/writing) - Smart contract language reference
- Get Lace wallet on the [Chrome Store](https://chromewebstore.google.com/detail/lace/gafhhkghbfjjkeiendhlofajokpaflmk) or the [Edge Store](https://microsoftedge.microsoft.com/addons/detail/lace/efeiemlfnahiidnjglmehaihacglceia)

## Troubleshooting

| Common Issue                       | Solution                                                                                                  |
| ---------------------------------- |-----------------------------------------------------------------------------------------------------------|
| `npm install` fails                | Ensure you're using Node `v24.11.1` or newer. Older Node versions can install with warnings but are not the target runtime |
| Contract compilation fails         | Ensure the Compact toolchain is installed and run `npm run compact` from `contract/`                      |
| Network connection timeout         | CLI requires internet connection, restart if connection times out                                         |
| Token funding takes too long       | Wait 1-2 minutes, funding is automatic in CLI                                                             |
| "Application not authorized" error | Start proof server: `docker compose -f proof-server-local.yml up -d`                                      |
| Lace wallet not detected           | Install Lace wallet browser extension and refresh page                                                    |
| Docker issues                      | Ensure Docker Desktop is running, check `docker --version`                                                |
| Port 6300 in use                   | Run `docker compose down` then restart services                                                           |
| Dependencies won't install         | Use Node.js LTS version. For older npm versions, you may need `--legacy-peer-deps`                        |
| Contract deployment fails          | Verify wallet has sufficient balance and network connection                                               |

## Notes

- CLI and UI can run simultaneously and share the same proof server
- Proof server (Docker) is required for both CLI and UI to generate zero-knowledge proofs
- Contract must be compiled before building CLI or UI
- Fund your wallet using the testnet faucet before deploying contracts

## Implementation Notes

- **Transaction fee configuration**  
  The default `additionalFeeOverhead` value (`500_000_000_000_000_000n`) from `@midnight-ntwrk/testkit-js` is required on the `undeployed` network. Lower values can fail with `BalanceCheckOverspend` on the node side. On remote networks, that overhead requires too much dust, so the CLI overrides it to `1_000n`.
- CLI private state is stored per contract address, matching the `Midnight.js 4.x` private-state provider model.

---

# Confidential Splits Integration Guide

Confidential Splits is a privacy-preserving group expense tracker built on the Midnight blockchain. It allows groups to split expenses and settle simplified balances without disclosing their private running balances, private witness details, or confidential salts to the public ledger.

---

## 1. Why Midnight?
Traditional blockchain state is public by default, exposing every user's transaction history, balances, and financial routing graphs. Midnight solves this by dividing applications into public ledger states and private client states. DApps execute private calculations on browser extensions, generating zero-knowledge proofs (ZKPs) that prove validity without leaking underlying secrets.

---

## 2. Privacy Boundary Model
The application maintains a strict separation between public and private scopes:

* **PRIVATE (Shielded)**:
  * Running net balances of group participants.
  * Ephemeral random salts used to blind balance commitments.
  * ZK witness keys used to verify identity.
* **PUBLIC (On-chain)**:
  * Contract address and group name.
  * Disclosed ZK public keys stored in the dynamic `members` vector.
  * Pending expense shares, payer indices, and total transaction amounts (only visible during the active synchronization phase).
  * Pending payment routing indices and settlement amounts (only visible during the active payment phase).

---

## 3. Dynamic Membership & Invite Flow
* **Creator**: Wallet A connects to the DApp, derives a deterministic ZK witness key, and deploys the contract. Slot 0 is assigned Wallet A's public key; Slots 1–3 are initialized as vacant (`pad(32, "")`).
* **Invite URL**: Creator shares the invite URL:
  `http://localhost:5173/?join=<contractAddress>`
  The invite link contains only the public contract address, leaking no salts, seeds, or private parameters.
* **Joining**: Guest opens the invite URL, connects a different wallet (Wallet B), and clicks **Join Slot** next to a vacant Slot index. The DApp executes the ZK `join_group` circuit, writing their ZK public key to the vacant ledger index.
* **Signatures & Signers**: Signatures are handled by the injected **1AM Wallet/connector API**. The DApp does not access or expose the user's seed phrases or wallet private keys.

---

## 4. Transaction Lifecycles & Circuits

The contract implements five main ZK proof circuits:
1. **`join_group(idx)`**: Claims a vacant index slot, disclosing the user's ZK public key.
2. **`post_expense(payer_idx, amount, shares)`**: Posts a split expense. Payer selection dropdown contains strictly active joined members. Unjoined members get $0$ shares; the sum of shares equals the total amount.
3. **`sync_balance(idx, old_balance, old_salt, new_salt)`**: Syncs private net balances client-side by updating the member's private commitment in ZK.
4. **`post_payment(debtor, creditor, amount, old_balance, old_salt, new_salt)`**: Enforces that only the debtor index matching the active signer can authorize payments.
5. **`claim_payment(old_balance, old_salt, new_salt)`**: Enforces that only the creditor index matching the active signer can claim settlement payouts.

### Transaction State Machine
Every transaction progresses through actual async states:
```
IDLE ──► PREPARING ──► PROVING ──► AWAITING_WALLET ──► SUBMITTED ──► CONFIRMED
```
Transactions only transition to `CONFIRMED` once they are successfully verified by the Midnight Preprod indexer.

---

## 5. Settlement Algorithm
The **Settlement Optimizer** runs a local deterministic greedy minimum cash flow simplification client-side. It identifies the maximum debtor and maximum creditor, creates a payment routing flow, and updates transient balances. **This is classified as local deterministic computation, not a mock.** Actual balance settlements require executing real on-chain `post_payment` and `claim_payment` circuits.

---

## 6. Setup & Developer Commands

### Local Proof Server (Docker)
Start the local proof server in Docker:
```bash
cd bboard-cli
docker compose -f proof-server-local.yml up -d
cd ..
```

### Build and Dev Server
1. Install dependencies: `npm install`
2. Compile contract: `npm run compact --workspace=contract`
3. Start UI local dev server: `npm run dev --workspace=bboard-ui`
4. Run automated tests: `npm test --workspace=contract`
5. Bundle for production: `npm run build --workspace=bboard-ui`

---

## 7. Current Limitations & Constraints
* **Cap Size**: Maximum of 4 group participants.
* **Sequential Sync**: Balance syncs and settlements must be processed sequentially per participant to protect shielded balance transition invariants.

---

## 8. Real Midnight Preprod E2E Evidence

* **Contract Address**: `PENDING`
* **Deployment Tx Hash**: `PENDING`
* **join_group Tx Hash**: `PENDING`
* **post_expense Tx Hash**: `PENDING`
* **sync_balance Tx Hash**: `PENDING`
* **post_payment Tx Hash**: `PENDING`
* **claim_payment Tx Hash**: `PENDING`

---

## Level 4 Submission

* **GitHub**: [https://github.com/sylvia-barick/midlev4](https://github.com/sylvia-barick/midlev4)
* **Live Demo**: PENDING (Local/Preprod build verified; public deployment not yet performed)
* **Preprod Contract**: PENDING (Requires on-chain Wallet A deployment)
* **CI/CD**: [https://github.com/sylvia-barick/midlev4/actions/workflows/ci.yaml](https://github.com/sylvia-barick/midlev4/actions/workflows/ci.yaml)
* **X (Twitter)**: PENDING (Requires manual account creation)
* **Demo Video**: PENDING (Requires manual recording of E2E verification flow)
