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
 * Non-interactive script that builds (or reuses) a single real wallet on the
 * Midnight preprod network, funds it from the real preprod faucet, and submits
 * a batch of genuine on-chain transactions (contract deploy + alternating
 * post/takeDown calls) against the bulletin board contract. Every transaction
 * hash returned here comes back from the real preprod indexer/node - nothing
 * is fabricated or mocked.
 *
 * Usage:
 *   WALLET_SEED=<hex seed>   (optional - reuse an existing wallet; omit to generate a fresh one)
 *   POPULATE_CYCLES=25       (optional - number of post+takeDown cycles; defaults to 25 => 50 txs)
 *   npm run populate-preprod --workspace bboard-cli   (or run the compiled script directly)
 */

import { WebSocket } from 'ws';
import fs from 'node:fs';
import path from 'node:path';
import { createLogger } from '../logger-utils.js';
import { currentDir, PreprodRemoteConfig } from '../config.js';
import { MidnightWalletProvider } from '../midnight-wallet-provider.js';
import { waitForUnshieldedFunds, syncWallet, getInitialUnshieldedState } from '../wallet-utils.js';
import { generateDust } from '../generate-dust.js';
import { unshieldedToken } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';
import { UnshieldedAddress } from '@midnight-ntwrk/wallet-sdk-address-format';
import { getNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { BBoardAPI, type BBoardProviders, type PrivateStateId, bboardPrivateStateKey } from '../../../api/src/index.js';
import { randomBytes } from '../../../api/src/utils/index.js';
import { BBoardPrivateState } from '../../../contract/src/witnesses.js';

// @ts-expect-error: needed for WebSocket usage through apollo, mirrors index.ts
globalThis.WebSocket = WebSocket;

type TxRecord = {
  action: string;
  txHash: string;
  blockHeight?: number;
};

const NUM_CYCLES = Number(process.env.POPULATE_CYCLES ?? 25);

const config = new PreprodRemoteConfig();
const logger = await createLogger(config.logDir);
const testEnv = config.getEnvironment(logger);

const results: TxRecord[] = [];
let walletProvider: MidnightWalletProvider | undefined;

try {
  const env = await testEnv.start();
  logger.info(`Environment started with configuration: ${JSON.stringify(env)}`);

  const seed = process.env.WALLET_SEED ?? toHex(randomBytes(32));
  logger.info(`Using wallet seed: ${seed}`);

  walletProvider = await MidnightWalletProvider.build(logger, env, seed);
  await walletProvider.start();

  const initialUnshielded = await getInitialUnshieldedState(logger, walletProvider.wallet.unshielded);
  const address = UnshieldedAddress.codec.encode(getNetworkId(), initialUnshielded.address).toString();
  logger.info(`Wallet unshielded address: ${address}`);

  const unshieldedState = await waitForUnshieldedFunds(logger, walletProvider.wallet, env, unshieldedToken(), true);
  const nightBalance = unshieldedState.balances[unshieldedToken().raw];
  logger.info(`Wallet NIGHT balance after faucet: ${nightBalance}`);
  if (nightBalance === undefined || nightBalance === 0n) {
    throw new Error('Faucet funding failed - wallet balance is still zero.');
  }

  const dustTx = await generateDust(logger, seed, unshieldedState, walletProvider.wallet);
  if (dustTx) {
    results.push({ action: 'generateDust', txHash: dustTx });
  }
  await syncWallet(logger, walletProvider.wallet);

  const zkConfigProvider = new NodeZkConfigProvider<'post' | 'takeDown'>(config.zkConfigPath);
  const providers: BBoardProviders = {
    privateStateProvider: levelPrivateStateProvider<PrivateStateId, BBoardPrivateState>({
      privateStateStoreName: config.privateStateStoreName,
      signingKeyStoreName: `${config.privateStateStoreName}-signing-keys`,
      privateStoragePasswordProvider: () => 'Bboard-Test-2026!',
      accountId: seed,
    }),
    publicDataProvider: indexerPublicDataProvider(env.indexer, env.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(env.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };

  const api = await BBoardAPI.deploy(providers, logger);
  const deployTx = api.deployedContract.deployTxData.public;
  results.push({ action: 'deploy', txHash: deployTx.txHash, blockHeight: deployTx.blockHeight });
  logger.info(`Deployed contract at ${api.deployedContractAddress}, tx ${deployTx.txHash}`);

  for (let i = 1; i <= NUM_CYCLES; i++) {
    const postTx = await api.deployedContract.callTx.post(`preprod-populate #${i} seed=${seed.slice(0, 8)}`);
    results.push({ action: `post#${i}`, txHash: postTx.public.txHash, blockHeight: postTx.public.blockHeight });
    logger.info(`[${i}/${NUM_CYCLES}] post tx: ${postTx.public.txHash}`);

    const downTx = await api.deployedContract.callTx.takeDown();
    results.push({ action: `takeDown#${i}`, txHash: downTx.public.txHash, blockHeight: downTx.public.blockHeight });
    logger.info(`[${i}/${NUM_CYCLES}] takeDown tx: ${downTx.public.txHash}`);

    // Persist progress after every cycle so partial results survive an interruption.
    writeResults(seed, address, api.deployedContractAddress, results);
  }

  logger.info(`Done. Submitted ${results.length} real transactions from wallet ${address}.`);
} catch (e) {
  logger.error(e instanceof Error ? `Fatal error: ${e.message}\n${e.stack}` : 'Fatal error (unknown type)');
  throw e;
} finally {
  try {
    if (walletProvider) {
      await walletProvider.stop();
    }
  } finally {
    await testEnv.shutdown();
  }
}

function writeResults(seed: string, address: string, contractAddress: string, txs: TxRecord[]): void {
  const outPath = path.resolve(currentDir, '..', 'preprod-populate-results.json');
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        network: 'preprod',
        walletSeed: seed,
        walletAddress: address,
        contractAddress,
        explorerWalletUrl: `https://preprod.midnightexplorer.com/address/${address}`,
        explorerContractUrl: `https://preprod.midnightexplorer.com/address/${contractAddress}`,
        totalTransactions: txs.length,
        transactions: txs,
      },
      null,
      2,
    ),
  );
}
