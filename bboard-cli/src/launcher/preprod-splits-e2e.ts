// This file is part of midnightntwrk/example-bboard.
// Copyright (C) Midnight Foundation
// SPDX-License-Identifier: Apache-2.0
// Licensed under the Apache License, Version 2.0 (the "License");
// You may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/*
 * Non-interactive script that runs the Confidential Splits contract's real, own
 * end-to-end flow against the real Midnight Preprod network: two independently
 * built and faucet-funded wallets (Wallet A = creator/slot 0, Wallet B = member/slot 1)
 * deploy the contract, join, post an expense, sync private balances, post a
 * settlement payment, and claim it - each step a genuine on-chain transaction
 * verified against the real Preprod indexer. Nothing here is mocked or simulated.
 *
 * This exercises the exact same contract (`contract/src/splits.compact`) and the
 * exact same `SplitsAPI` (`api/src/splits-api.ts`) that `bboard-ui/src/App.tsx` uses
 * in the browser. It reproduces the browser's own identity derivation
 * (`secretKey = SHA-256(unshieldedAddress)`, see `hashAddressToSecretKey` in App.tsx)
 * byte-for-byte, but drives it from two programmatic wallets built via
 * MidnightWalletProvider/testkit-js instead of two browser tabs each running the
 * 1AM wallet extension - the same substitution this repo's own
 * `populate-preprod.ts` already makes for the legacy BBoard contract.
 *
 * RESUMABLE BY DESIGN: wallet seeds are persisted to preprod-splits-e2e-wallets.json
 * *before* any faucet request, and every completed step is persisted to
 * preprod-splits-e2e-results.json as it happens. Re-running this script after an
 * interruption reuses the same wallets (waitForUnshieldedFunds skips the faucet call
 * entirely if the wallet already has a balance) and skips every already-completed
 * contract step, so an interrupted run never wastes another faucet request or redoes
 * on-chain work that already succeeded.
 *
 * Usage:
 *   cd bboard-cli
 *   npm run preprod-splits-e2e
 *
 * Requires real internet access to the Preprod RPC/indexer/faucet (a local proof
 * server is started automatically by testkit-js's RemoteTestEnvironment).
 */

import { webcrypto } from 'node:crypto';
import { WebSocket } from 'ws';
import fs from 'node:fs';
import path from 'node:path';
import { createLogger } from '../logger-utils.js';
import { currentDir, PreprodRemoteConfig, type Config } from '../config.js';
import { MidnightWalletProvider } from '../midnight-wallet-provider.js';
import { waitForUnshieldedFunds, syncWallet, getInitialUnshieldedState } from '../wallet-utils.js';
import { generateDust } from '../generate-dust.js';
import { unshieldedToken } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { toHex, fromHex, assertIsContractAddress } from '@midnight-ntwrk/midnight-js-utils';
import { type ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { UnshieldedAddress } from '@midnight-ntwrk/wallet-sdk-address-format';
import { getNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { SplitsAPI, type SplitsProviders, type SplitsPrivateState } from '../../../api/src/index.js';
import * as Splits from '../../../contract/src/managed/splits/contract/index.js';

// @ts-expect-error: needed for WebSocket usage through apollo, mirrors index.ts / populate-preprod.ts
globalThis.WebSocket = WebSocket;

const INDEXER_URL = 'https://indexer.preprod.midnight.network/api/v4/graphql';

type TxRecord = {
  step: string;
  wallet: 'A' | 'B';
  txHash: string;
  blockHeight?: number;
  timestamp: string;
};

type WalletState = {
  seedA: string;
  seedB: string;
  addressA?: string;
  addressB?: string;
  saltAHex?: string;
  saltBHex?: string;
};

const config = new PreprodRemoteConfig();
const logger = await createLogger(config.logDir);

const OUT_PATH = path.resolve(currentDir, '..', 'preprod-splits-e2e-results.json');
const WALLET_STATE_PATH = path.resolve(currentDir, '..', 'preprod-splits-e2e-wallets.json');

function loadWalletState(): WalletState {
  if (fs.existsSync(WALLET_STATE_PATH)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(WALLET_STATE_PATH, 'utf-8')) as WalletState;
      logger.info(`Reusing persisted wallet seeds from ${WALLET_STATE_PATH} (avoids redundant faucet requests).`);
      return parsed;
    } catch {
      // fall through to generating fresh state
    }
  }
  return {
    seedA: toHex(webcrypto.getRandomValues(new Uint8Array(32))),
    seedB: toHex(webcrypto.getRandomValues(new Uint8Array(32))),
  };
}

let walletState: WalletState = loadWalletState();
function saveWalletState(): void {
  fs.writeFileSync(WALLET_STATE_PATH, JSON.stringify(walletState, null, 2));
}
saveWalletState();

function loadResults(): { contractAddress?: string; transactions: TxRecord[] } {
  if (fs.existsSync(OUT_PATH)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(OUT_PATH, 'utf-8')) as { contractAddress?: string; transactions?: TxRecord[] };
      return { contractAddress: parsed.contractAddress ?? undefined, transactions: parsed.transactions ?? [] };
    } catch {
      // fall through
    }
  }
  return { transactions: [] };
}

const loaded = loadResults();
const results: TxRecord[] = loaded.transactions;
const hasStep = (step: string, wallet: 'A' | 'B'): boolean => results.some((r) => r.step === step && r.wallet === wallet);

/** Byte-for-byte port of `hashAddressToSecretKey` in bboard-ui/src/App.tsx (SHA-256 of the UTF-8 address). */
async function hashAddressToSecretKey(address: string): Promise<Uint8Array> {
  const msgUint8 = new TextEncoder().encode(address);
  const hashBuffer = await webcrypto.subtle.digest('SHA-256', msgUint8);
  return new Uint8Array(hashBuffer);
}

function record(step: string, wallet: 'A' | 'B', txHash: string, blockHeight?: number): void {
  results.push({ step, wallet, txHash, blockHeight, timestamp: new Date().toISOString() });
  writeState('in-progress');
  logger.info(`[${wallet}] ${step}: txHash=${txHash} blockHeight=${blockHeight ?? 'pending'}`);
}

let contractAddress: ContractAddress | undefined = loaded.contractAddress as ContractAddress | undefined;
let indexerVerification: unknown;

function writeState(status: 'in-progress' | 'complete' | 'failed', error?: string): void {
  fs.writeFileSync(
    OUT_PATH,
    JSON.stringify(
      {
        network: 'preprod',
        indexerUrl: INDEXER_URL,
        status,
        error: error ?? null,
        walletA: walletState.addressA ?? null,
        walletB: walletState.addressB ?? null,
        contractAddress: contractAddress ?? null,
        transactions: results,
        indexerVerification: indexerVerification ?? null,
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
}

/**
 * `testEnv.start()` runs a health check that includes a hardcoded 1000ms-timeout GET against
 * the real Preprod faucet's `/api/health` (see `FaucetClient.health()` in
 * `@midnight-ntwrk/testkit-js`, not something this repo controls). Measured round-trip latency
 * to that endpoint from this environment sits right around 500-900ms, so the check is
 * genuinely flaky rather than broken - retry a few times rather than failing the whole run
 * on one slow response.
 */
async function startEnvWithRetry(
  role: string,
  attempts = 6,
): Promise<{ testEnv: ReturnType<Config['getEnvironment']>; env: Awaited<ReturnType<ReturnType<Config['getEnvironment']>['start']>> }> {
  let lastError: unknown;
  for (let i = 1; i <= attempts; i++) {
    // A fresh TestEnvironment per attempt: reusing one across retries left an already-started
    // proof-server container running (attempt 1 can succeed at the container-start stage and
    // only fail later, e.g. at the faucet health check), so retrying start() on the *same*
    // instance without shutting it down first caused every subsequent attempt to collide with
    // its own leftover container name.
    const testEnv = config.getEnvironment(logger);
    try {
      const env = await testEnv.start();
      return { testEnv, env };
    } catch (e) {
      lastError = e;
      const message = e instanceof Error ? e.message : String(e);
      logger.warn(`[${role}] testEnv.start() attempt ${i}/${attempts} failed: ${message}. Tearing down and retrying...`);
      await testEnv.shutdown().catch(() => {});
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`[${role}] testEnv.start() failed after ${attempts} attempts`);
}

async function buildFundedWallet(role: 'A' | 'B', seed: string): Promise<{ provider: MidnightWalletProvider; address: string }> {
  const { env } = await startEnvWithRetry(role);
  const walletProvider = await MidnightWalletProvider.build(logger, env, seed);
  await walletProvider.start();

  const initialUnshielded = await getInitialUnshieldedState(logger, walletProvider.wallet.unshielded);
  const address = UnshieldedAddress.codec.encode(getNetworkId(), initialUnshielded.address).toString();
  logger.info(`[${role}] Unshielded address: ${address}`);
  const alreadyFunded = (initialUnshielded.balances[unshieldedToken().raw] ?? 0n) > 0n;
  if (alreadyFunded) {
    logger.info(`[${role}] Wallet already has a positive balance from a prior run - skipping faucet request entirely.`);
  }

  // waitForUnshieldedFunds only calls the faucet if the wallet's *current* balance is zero,
  // so re-running this with a wallet that already received funds never re-requests tokens.
  const unshieldedState = await waitForUnshieldedFunds(logger, walletProvider.wallet, env, unshieldedToken(), true);
  const nightBalance = unshieldedState.balances[unshieldedToken().raw];
  logger.info(`[${role}] NIGHT balance: ${nightBalance}`);
  if (nightBalance === undefined || nightBalance === 0n) {
    throw new Error(`[${role}] Faucet funding failed - wallet balance is still zero.`);
  }

  const dustTx = await generateDust(logger, seed, unshieldedState, walletProvider.wallet);
  if (dustTx && !hasStep('generateDust', role)) {
    record('generateDust', role, dustTx);
  }
  await syncWallet(logger, walletProvider.wallet);

  return { provider: walletProvider, address };
}

function makeProviders(walletProvider: MidnightWalletProvider, storeSuffix: string, seed: string): SplitsProviders {
  const zkConfigProvider = new NodeZkConfigProvider(path.resolve(currentDir, '..', '..', 'contract', 'src', 'managed', 'splits'));
  return {
    privateStateProvider: levelPrivateStateProvider<'splitsPrivateState', SplitsPrivateState>({
      privateStateStoreName: `splits-e2e-${storeSuffix}`,
      signingKeyStoreName: `splits-e2e-${storeSuffix}-signing-keys`,
      privateStoragePasswordProvider: () => 'Splits-E2E-2026!',
      accountId: seed,
    }),
    publicDataProvider: indexerPublicDataProvider(walletProvider.env.indexer, walletProvider.env.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(walletProvider.env.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  } as unknown as SplitsProviders;
}

async function getLedger(providers: SplitsProviders, address: ContractAddress) {
  assertIsContractAddress(address);
  const state = await providers.publicDataProvider.queryContractState(address);
  if (state === null) {
    throw new Error(`No contract state found at ${address}`);
  }
  return Splits.ledger(state.data);
}

async function verifyIndependently(txHash: string): Promise<unknown> {
  const query = `query{transactions(offset:{hash:"${txHash}"}){hash unshieldedCreatedOutputs{owner value tokenType} unshieldedSpentOutputs{owner value tokenType} block{height}}}`;
  const res = await fetch(INDEXER_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  return res.json();
}

async function main(): Promise<void> {
  writeState('in-progress');
  let walletA: MidnightWalletProvider | undefined;
  let walletB: MidnightWalletProvider | undefined;

  try {
    logger.info('=== Building & funding Wallet A (creator, slot 0) ===');
    const builtA = await buildFundedWallet('A', walletState.seedA);
    walletA = builtA.provider;
    walletState.addressA = builtA.address;
    saveWalletState();

    logger.info('=== Building & funding Wallet B (member, slot 1) ===');
    const builtB = await buildFundedWallet('B', walletState.seedB);
    walletB = builtB.provider;
    walletState.addressB = builtB.address;
    saveWalletState();

    const providersA = makeProviders(walletA, 'A', walletState.seedA);
    const providersB = makeProviders(walletB, 'B', walletState.seedB);

    const secretKeyA = await hashAddressToSecretKey(walletState.addressA);
    const secretKeyB = await hashAddressToSecretKey(walletState.addressB);
    const creatorPk = Splits.pureCircuits.publicKey(secretKeyA);

    let apiA: SplitsAPI;
    if (contractAddress) {
      logger.info(`[A] Reusing already-deployed contract at ${contractAddress} (from a previous run).`);
      apiA = await SplitsAPI.join(providersA, contractAddress, logger);
    } else {
      logger.info(`[A] Deploying Splits contract with creator pubkey ${toHex(creatorPk)}...`);
      apiA = await SplitsAPI.deploy(providersA, [creatorPk], logger);
      contractAddress = apiA.deployedContractAddress;
      const deployTxData = apiA.deployedContract.deployTxData.public;
      record('deploy', 'A', deployTxData.txHash, deployTxData.blockHeight);
      saveWalletState();
    }
    await apiA.changeActiveUser(0, secretKeyA);

    logger.info(`[B] Attaching to contract at ${contractAddress}...`);
    const apiB = await SplitsAPI.join(providersB, contractAddress, logger);
    await apiB.changeActiveUser(1, secretKeyB);

    if (!hasStep('join_group', 'B')) {
      logger.info('[B] Joining slot 1...');
      const joinTxData = await apiB.deployedContract.callTx.join_group(1n);
      record('join_group', 'B', joinTxData.public.txHash, joinTxData.public.blockHeight);
    } else {
      logger.info('[B] Already joined in a previous run - skipping join_group.');
    }

    if (!hasStep('post_expense', 'A')) {
      logger.info('[A] Posting expense: 1200 tNight split 50/50 between slots 0 and 1...');
      const postExpenseTx = await apiA.deployedContract.callTx.post_expense(0n, 1200n, [600n, 600n, 0n, 0n] as any);
      record('post_expense', 'A', postExpenseTx.public.txHash, postExpenseTx.public.blockHeight);
    } else {
      logger.info('[A] Expense already posted in a previous run - skipping post_expense.');
    }

    // A is the payer (idx 0): new_balance = 0 + (1200 - share[0]=600) = +600 (A is owed 600).
    const balanceA = 600n;
    let saltA: Uint8Array;
    if (!hasStep('sync_balance', 'A')) {
      logger.info('[A] Syncing private balance for slot 0...');
      saltA = webcrypto.getRandomValues(new Uint8Array(32));
      const syncATx = await apiA.deployedContract.callTx.sync_balance(0n, 0n, new Uint8Array(32), saltA);
      record('sync_balance', 'A', syncATx.public.txHash, syncATx.public.blockHeight);
      walletState.saltAHex = toHex(saltA);
      saveWalletState();
    } else {
      logger.info('[A] Already synced in a previous run - reusing the persisted salt.');
      if (!walletState.saltAHex) throw new Error('sync_balance(A) was recorded but its salt was not persisted - cannot resume safely.');
      saltA = fromHex(walletState.saltAHex);
    }

    // B is not the payer (idx 1): new_balance = 0 + (0 - share[1]=600) = -600 (B owes 600).
    const balanceB = -600n;
    let saltB: Uint8Array;
    if (!hasStep('sync_balance', 'B')) {
      logger.info('[B] Syncing private balance for slot 1...');
      saltB = webcrypto.getRandomValues(new Uint8Array(32));
      const syncBTx = await apiB.deployedContract.callTx.sync_balance(1n, 0n, new Uint8Array(32), saltB);
      record('sync_balance', 'B', syncBTx.public.txHash, syncBTx.public.blockHeight);
      walletState.saltBHex = toHex(saltB);
      saveWalletState();
    } else {
      logger.info('[B] Already synced in a previous run - reusing the persisted salt.');
      if (!walletState.saltBHex) throw new Error('sync_balance(B) was recorded but its salt was not persisted - cannot resume safely.');
      saltB = fromHex(walletState.saltBHex);
    }

    if (!hasStep('post_payment', 'B')) {
      // Must reopen B's *current* on-chain commitment, i.e. exactly the (balance, salt) pair
      // B's own sync_balance call above just committed - not a fresh salt - or the contract's
      // `balance_commitments[1] == commit(old_balance, old_salt)` assertion will fail on-chain.
      logger.info('[B] Posting settlement payment: 600 tNight from slot 1 (debtor) to slot 0 (creditor)...');
      const saltBAfterPayment = webcrypto.getRandomValues(new Uint8Array(32));
      const postPaymentTx = await apiB.deployedContract.callTx.post_payment(1n, 0n, 600n, balanceB, saltB, saltBAfterPayment);
      record('post_payment', 'B', postPaymentTx.public.txHash, postPaymentTx.public.blockHeight);
    } else {
      logger.info('[B] Payment already posted in a previous run - skipping post_payment.');
    }

    if (!hasStep('claim_payment', 'A')) {
      // Likewise must reopen A's current commitment using saltA from the sync_balance step.
      logger.info('[A] Claiming settlement payment...');
      const saltAAfterClaim = webcrypto.getRandomValues(new Uint8Array(32));
      const claimPaymentTx = await apiA.deployedContract.callTx.claim_payment(balanceA, saltA, saltAAfterClaim);
      record('claim_payment', 'A', claimPaymentTx.public.txHash, claimPaymentTx.public.blockHeight);
    } else {
      logger.info('[A] Already claimed in a previous run - skipping claim_payment.');
    }

    const finalLedger = await getLedger(providersA, contractAddress);
    logger.info(
      `Final ledger: members=${finalLedger.members.map(toHex).join(',')} pending_payment_status=${finalLedger.pending_payment_status}`,
    );

    const deployRecord = results.find((r) => r.step === 'deploy');
    if (deployRecord) {
      logger.info('=== Independent indexer verification of the deploy transaction ===');
      indexerVerification = await verifyIndependently(deployRecord.txHash);
      logger.info(JSON.stringify(indexerVerification));
    }

    writeState('complete');
    logger.info('=== Splits Preprod E2E complete. All 7 contract transactions are real, on-chain, and independently verifiable. ===');
  } catch (e) {
    logger.error(e instanceof Error ? `Fatal error: ${e.message}\n${e.stack}` : 'Fatal error (unknown type)');
    writeState('failed', e instanceof Error ? e.message : String(e));
    throw e;
  } finally {
    if (walletA) await walletA.stop();
    if (walletB) await walletB.stop();
  }
}

main().catch(() => process.exit(1));
