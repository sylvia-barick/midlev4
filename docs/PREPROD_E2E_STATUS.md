# Confidential Splits — App's Own Preprod E2E: Status

## 1. Purpose and scope

This document records what was actually attempted, verified, and found while trying to execute **Confidential Splits' own contract flow** (deploy → join → post expense → sync balances → post payment → claim payment) as real, on-chain transactions against the live Midnight Preprod network — as opposed to simulator tests or claims.

It exists because the prior status ("PENDING" in `docs/PREPROD_EVIDENCE.md`, `docs/FINAL_E2E_TEST.md`, `docs/FINAL_E2E_MATRIX.md`) did not distinguish "not yet attempted" from "attempted and blocked by an identified, reproduced defect" — this document makes that distinction explicit, with evidence.

**Bottom line: PARTIALLY VERIFIED, still BLOCKED overall.** Contract **deployment** is confirmed on real Preprod (see §2 below) — this was discovered mid-investigation, not fabricated, and was independently verified against the live indexer using this project's own compiled contract decoder. `join_group`, `post_expense`, `sync_balance`, `post_payment`, and `claim_payment` have **not** been submitted or confirmed for this application. The overall app-owned E2E chain (7 steps) is **not complete**; 1 of 7 is confirmed, 6 remain blocked. Nothing in this document should be read as claiming the full chain passed.

---

## 2. Confirmed: contract deployment on real Preprod

While reconciling this local investigation with `origin/master` (which had a commit predating this session, `8880f6f`, adding a bare "Contract Deployment Tx Hash" line to the README with no supporting context), that transaction hash was independently checked against the live Preprod indexer rather than accepted at face value.

**Verification method:** queried `https://indexer.preprod.midnight.network/api/v4/graphql` directly for the transaction, then fetched the resulting contract address's live on-chain state and decoded it with this project's own compiled `Splits.ledger()` function (`contract/src/managed/splits/contract/index.js`) — the same decoder `bboard-ui` and `bboard-cli`'s launcher scripts use — rather than trusting the raw hex or the README string.

| Field | Value |
|---|---|
| Transaction hash | `3cffa9d76a160c27c7d6f8299fbe3d2a3d3cb7b47382107cfd9c8804b1b55f66` |
| Block height | `2,119,943` |
| Contract address | `9a378876a47bc46b81d275c8e0c6ba40163009184565eb35414c7cc9d62467fd` |
| `members` (decoded) | `[b4aea032b7491a837b6118108a7e2f334a7ffa6e75afa33c28e14e9080620a42, 0, 0, 0]` — one real pubkey in slot 0, slots 1-3 empty |
| `balance_commitments` (decoded) | all four equal to `f5a5fd42d16a20302798ef6ed309979b43003d2320d9f0e8ea9831a92759fb4b`, i.e. the constructor's default `commit(0, pad(32,""))` |
| `synced_mask` (decoded) | `[true, true, true, true]` — constructor default |
| `pending_expense_amount` / `pending_payment_status` (decoded) | `0` / `0` — constructor defaults, nothing posted |
| Is this the only action on this contract? | Yes — querying the address's *current* state and its *first* recorded transaction both resolve to this same tx hash |

**What this proves:** a real Splits contract was genuinely deployed on Preprod, with a real creator public key in slot 0. **What this does not prove:** anything beyond deployment. The decoded state is byte-for-byte the constructor's genesis output — no `join_group`, `post_expense`, `sync_balance`, `post_payment`, or `claim_payment` has ever touched this contract instance.

**Provenance:** this deployment was **not** produced by this repository's `preprod-splits-e2e.ts` or `populate-preprod.ts` (§6-§8 below) — both generate fresh random wallet seeds every run and neither ever got past the faucet-funding stage before hanging. This deployment predates this investigation entirely and most likely came from the real browser UI (`bboard-ui`) with an actual 1AM wallet — the intended end-user path this investigation did not have a working browser+extension setup to test directly (see §11).

---

## 3. The intended real E2E flow

This is the exact chain that a successful run is required to complete, end to end, with no step skipped or simulated:

```
Wallet funding (real Preprod faucet)
  → sufficient Preprod balance confirmed on-chain
  → contract deployment (real transaction)
  → real application transaction (join_group / post_expense / sync_balance / post_payment / claim_payment)
  → transaction confirmation (block inclusion)
  → real transaction hash / ID recorded
  → real block height recorded
  → independent verification via the live Preprod indexer (GraphQL query, not this repo's own claim)
  → application reads/reflects the confirmed result (ledger state updates: members, balance_commitments, pending_payment_status)
```

The exact code path was traced directly from source (not assumed) across `contract/src/splits.compact`, `api/src/splits-api.ts`, and `bboard-ui/src/App.tsx` — see `bboard-cli/src/launcher/preprod-splits-e2e.ts` for the resulting non-interactive script, which reproduces the browser UI's own identity derivation (`secretKey = SHA-256(unshieldedAddress)`) byte-for-byte and drives the same `SplitsAPI` class the UI uses, via two independently funded wallets (`MidnightWalletProvider`) instead of two browser tabs running the 1AM extension.

---

## 4. Environment and versions used

| Component | Value |
|---|---|
| Network | Midnight **Preprod** (`https://rpc.preprod.midnight.network`, `https://indexer.preprod.midnight.network/api/v4/graphql`, faucet `https://midnight-tmnight-preprod.nethermind.dev/`) |
| `@midnight-ntwrk/wallet-sdk` | `1.2.0` (pinned via root `package.json` `resolutions`) |
| `@midnight-ntwrk/wallet-sdk-dust-wallet` (transitive) | `4.2.0` |
| `@midnight-ntwrk/testkit-js` | as locked in `package-lock.json` |
| Proof server | Docker image `midnightntwrk/proof-server:8.0.3`, started automatically by `testkit-js`'s `RemoteTestEnvironment` |
| Node.js | v24.18.1 (WSL, matching `.nvmrc`'s `24.11.1` requirement) |
| Compact compiler | `0.31.1` (contract already compiled; `contract/src/managed/splits/` present) |

---

## 5. What was independently confirmed working

Before concluding anything was "blocked," each of the following was verified in isolation, with no shortcuts:

- Docker Engine and Docker Compose function correctly in this environment; the proof-server container builds and responds `{"status":"ok"}` on its health endpoint.
- Real network egress to the Preprod RPC, indexer, and faucet all succeed (`Connected to node ... {"peers":13-15,"isSyncing":false}`, `Connected to indexer ... ready`, `Connected to faucet ... {"status":"ok","details":{"faucet-wallet":"ok"}}`).
- A raw WebSocket connection to `wss://rpc.preprod.midnight.network` (opened directly with the `ws` package, independent of the wallet SDK) stays open and idle-stable for 15+ seconds with no spontaneous disconnect — ruling out a raw network/firewall instability as the cause of what follows.
- Wallet construction (`MidnightWalletProvider.build`) succeeds and derives a real, valid Preprod unshielded address.
- The real Preprod faucet accepts the funding request and responds `Faucet response: OK` for that address.
- Contract compilation, all 27 Vitest simulator tests, and TypeScript/ESLint checks all pass (unrelated to this blocker, confirming the contract logic itself is sound).

---

## 6. Real attempted runs (evidence)

All timestamps below are real log output from actual runs against the live Preprod network — not fabricated. No transaction hash, block height, or balance appears in this table because none was ever produced; only the funding request stage was reached before each run hung.

| Run | Script | Wallet address | Faucet request time (UTC) | Outcome |
|---|---|---|---|---|
| 1 | `preprod-splits-e2e.ts` (this project's new resumable E2E script) | `mn_addr_preprod1f39x73ham2kg2nkqqktuzkxr6ep0w52jdya8yfa35yc50mth24fskt4efu` | 2026-08-25 15:16:46Z | Faucet responded OK; wallet then hung indefinitely waiting for balance sync (confirmed still running, 0% progress, after 31 minutes — see §6) |
| 2 | `preprod-splits-e2e.ts` (retry, same persisted wallet seed, no duplicate faucet request needed) | same address | 2026-08-25 15:49:20Z | Same hang, reproduced again |
| 3 (control) | `populate-preprod.ts` — **this repository's own pre-existing, unmodified script**, run standalone as a diagnostic | `mn_addr_preprod1py3llfp42fpajm90lx5yhkvqc3rtslexupmyrsp5kc8px7t9phzq7rkfta` | 2026-08-25 16:21:18Z | Same hang, reproduced a third time, in code this investigation did not write or modify |

Each hung process was killed manually after the pattern was confirmed; associated orphaned Docker containers (`proof-server_<uid>`, `testcontainers-ryuk-<id>`) were cleaned up. No wallet in this table has a confirmed non-zero balance as of this writing — the faucet requests were accepted, but this investigation has no evidence either way on whether tokens were ever actually credited, since the process never survived long enough to observe a balance.

---

## 7. Root cause: a reproducible hang inside the wallet SDK's dust-wallet sync

Every attempt fails at the identical point, in the identical way:

1. The wallet is built and requests funds from the faucet; the faucet accepts the request.
2. `waitForUnshieldedFunds` logs `Waiting to receive tokens...` and begins listening for a balance update.
3. Within ~3 seconds, the log shows: `RPC-CORE: subscribeRuntimeVersion(): RuntimeVersion:: disconnected from wss://rpc.preprod.midnight.network/: 1000:: Normal Closure` (logged twice).
4. Immediately after, an uncaught internal defect is printed: `Wallet.Sync: [object Object]` with a stack trace rooted in `node_modules/@midnight-ntwrk/wallet-sdk-dust-wallet/dist/v1/Sync.js` and the `effect` library's cause-handling internals (`_tag: 'Wallet.Sync'`).
5. The Node process does **not** exit and does **not** throw up to application code — it remains alive and CPU-active (confirmed via `ps -o pid,etimes,stat`: state `Rl`, elapsed time growing) but produces **no further log output**. This was directly observed for **31 continuous minutes** with zero progress in one run before being killed.

Reading the relevant source, `wallet-sdk-dust-wallet`'s own code comment in `Sync.js` describes exactly this class of failure:

> "The boundary is load-bearing, not waste: this subscription emits only events (no tip/progress sentinel), and `isConnected`/the tip (`maxId`) are set only when an event is received. So the cursor must stay `<= appliedIndex` — never `appliedIndex + 1`. Requesting one event later would deliver nothing to a wallet already at the tip, so `applyUpdate` would never run and **sync would hang**."

This is the SDK authors' own documented awareness of a subscription-cursor edge case that causes exactly the symptom observed (dust-ledger-event sync never progressing for a wallet with no events yet, i.e. a freshly funded/unfunded wallet at the tip). This document treats the cursor-boundary logic in `Sync.js` as the **root cause identified and reproduced during this investigation** — not as an officially confirmed defect, since no Midnight maintainer or upstream issue has been consulted or has confirmed this. It is a finding from direct source inspection and reproduction, stated at that level of confidence and no higher.

---

## 8. Confirmed not specific to this project's new code

To rule out a bug introduced by `preprod-splits-e2e.ts` (written for this investigation), the exact same hang was reproduced using `bboard-cli/src/launcher/populate-preprod.ts` — a script that already existed in this repository, unmodified, targeting the legacy BBoard contract instead of Splits. It uses the identical wallet-build → faucet-fund → wait-for-balance code path (`MidnightWalletProvider`, `waitForUnshieldedFunds`, same wallet SDK). It hung in the identical way, at the identical point, with the identical log signature. This confirms the defect is in the shared wallet SDK layer, not in any Splits-specific or newly written code.

---

## 9. Dependency upgrade investigation

Before concluding this was unfixable within safe bounds, the following was checked directly against the npm registry (not assumed):

| Package | Installed | Latest **stable** release | Next available release |
|---|---|---|---|
| `@midnight-ntwrk/wallet-sdk` | `1.2.0` | `1.2.0` (already the newest stable release) | `1.2.1-canary.*` / `2.0.0-beta.x` (pre-release only) |
| `@midnight-ntwrk/wallet-sdk-dust-wallet` | `4.2.0` | `4.2.0` (already the newest stable release) | `4.2.1-canary.*` (3 builds, all dated June 2026, superseded — not an actively maintained fix branch) / `5.0.0-beta.x` (pre-release only) |

The only actively-developed newer code is the `1.2.1-canary` / `2.0.0-beta` line. Its own published dependency graph was inspected directly (`npm view ... dependencies`), and it requires simultaneous major-version bumps across the entire sibling SDK family as an interlocked pre-release set: `wallet-sdk-dust-wallet` 4→5, `wallet-sdk-facade` 4→5, `wallet-sdk-unshielded-wallet` 2→3, and ten other sub-packages, none of them stable.

**Conclusion: no safe, narrow dependency update exists today.** The only available newer build is an entire pre-release major-version migration touching every wallet integration point in this codebase (`bboard-cli/src/midnight-wallet-provider.ts`, `wallet-utils.ts`, `generate-dust.ts`, `api/src/splits-api.ts`, `bboard-ui`'s wallet context), with no changelog or upstream confirmation that it even fixes this specific issue. Per the explicit decision made during this investigation, **no dependency version was changed** — `package.json` and `package-lock.json` remain exactly as they were. Forcing an unvalidated pre-release major-version migration to chase an unconfirmed fix was judged less safe than leaving the dependency tree untouched and documenting the blocker.

---

## 10. Relationship to the 339 real Preprod addresses

**These are two entirely separate pieces of evidence and must not be conflated:**

- **The 339-address scanner** (`bboard-cli/src/launcher/scan-preprod-addresses.ts`, documented in the main `README.md` §5–§8) independently walks the public Preprod indexer and proves that **339 distinct wallet addresses have real, observable, verifiable on-chain activity** on the Preprod network, generated by *other* real usage of the network unrelated to this application.
- **This document** concerns whether *this specific application* (Confidential Splits) has completed its *own* deploy → join → expense → sync → payment → claim transaction sequence.

The 339-address scan proves that real, observable Preprod activity genuinely exists and is independently verifiable. **It does not, and was never claimed to, prove that this application completed its own end-to-end flow.** The two are unrelated evidence for two different requirements, and this document's BLOCKED status has no bearing on the validity of the 339-address result, nor does the 339-address result substitute for this one.

---

## 11. Next possible resolution

Only legitimate options are listed. None of the following is claimed to be guaranteed, in progress, or already confirmed by anyone outside this investigation:

- **An upstream fix in the Midnight wallet SDK.** If the cursor-boundary condition described in §6 is patched in a future *stable* release of `@midnight-ntwrk/wallet-sdk-dust-wallet`, retrying this project's existing, unmodified E2E scripts (`preprod-splits-e2e.ts`, `populate-preprod.ts`) against that release would be the direct next step.
- **Guidance from Midnight maintainers.** This investigation reproduced and root-caused the hang from source inspection alone, with no upstream issue filed or maintainer response yet obtained. Filing the reproduction in §5–§7 with the Midnight team (e.g. via their Discord/forum/GitHub) and following their guidance is a legitimate path not yet taken.
- **A compatible, supported wallet/network path that avoids the affected code.** For example, driving the flow through the actual 1AM browser wallet extension (as an end user would, per `bboard-ui`) rather than the programmatic `MidnightWalletProvider`/testkit-js path, in case the browser extension's wallet stack does not share this exact dust-sync code path. This has not been attempted in this investigation and would require the 1AM extension installed and manually operated in a real browser.
- **Retrying after the underlying SDK issue is resolved**, rather than continuing to retry the currently-installed version, which has now failed identically on three independent real attempts (§5) including this repository's own pre-existing script (§7).

No other resolution should be assumed or attempted without one of the above actually occurring first.
