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
 * Chain-scan script that walks the Midnight Preprod indexer block-by-block and records
 * *distinct observable unshielded addresses* with per-address provenance - i.e. every
 * Bech32m `owner` address that appears on an unshielded UTXO (created or spent) in a real
 * transaction, along with the transaction hash(es), block height(s), and created/spent role
 * that make that observation independently verifiable against the live indexer.
 *
 * IMPORTANT ABOUT WHAT THIS DATA MEANS:
 *   - Midnight's indexer GraphQL API (see node_modules/@midnight-ntwrk/midnight-js-indexer-
 *     public-data-provider/dist/gen/graphql.d.ts) has no "unique addresses" or "active users"
 *     aggregate query. `Query.transactions` only accepts a single tx hash/identifier, not a
 *     range. The only way to enumerate history is `Query.block(offset: {height})`, one block
 *     at a time - so that's what this script does.
 *   - An address only ever enters the output because it was observed as the `owner` of a real
 *     unshielded UTXO created or spent in a real transaction returned by the live indexer -
 *     there is no fabrication, sampling, or synthesis anywhere in this script.
 *   - "Unique observable addresses" != "unique users". One person can hold many addresses, and
 *     shielded (private) transaction participants are not observable this way at all (that's
 *     the whole point of shielding). This is a lower/proxy bound on activity.
 *   - Contract addresses (from `contractActions`) and block authors (validators, from
 *     `block.author`) are tracked separately and are NEVER included in the exported address
 *     list, since neither represents an end-user wallet.
 *
 * Usage:
 *   cd bboard-cli
 *   LOOKBACK_DAYS=7 STOP_AT_ADDRESS_COUNT=50 npm run scan-preprod-addresses
 *
 * Env vars (all optional):
 *   MIDNIGHT_INDEXER_URL   GraphQL HTTP endpoint (default: preprod indexer)
 *   START_HEIGHT           first block height to scan (default: 0, or resumed checkpoint + 1)
 *   LOOKBACK_DAYS           if START_HEIGHT is not set, scan only the last N days of chain
 *                           history instead of from genesis, using the real measured average
 *                           block time (sampled live) rather than an assumed constant.
 *   END_HEIGHT             last block height to scan, inclusive (default: current chain tip)
 *   STOP_AT_ADDRESS_COUNT   if set (>0), stop scanning as soon as this many distinct addresses
 *                           have been observed, even if END_HEIGHT hasn't been reached. Useful
 *                           when you need "N verified addresses" rather than a full-window scan.
 *   CONCURRENCY             number of blocks fetched in parallel (default: 4)
 *   REQUEST_INTERVAL_MS     minimum spacing between request *starts*, enforced globally across
 *                           all workers (default: 350ms, i.e. ~2.9 req/s), independent of
 *                           CONCURRENCY. Needed in practice: concurrency=8 with no throttle
 *                           sustained ~28 req/s and got HTTP 403'd by the indexer's WAF within
 *                           about a minute during earlier testing of this script.
 *   REQUEST_TIMEOUT_MS      per-request abort timeout in ms (default: 20000).
 *   MAX_RETRIES             retries per block on transient failure (default: 5). A 403 response
 *                           is treated as a rate-limit block and backed off much more
 *                           aggressively (30s-180s) than other transient errors (1s-15s).
 *   MAX_STORED_APPEARANCES  max tx-hash/height/role records kept per address (default: 25).
 *                           createdCount/spentCount/totalAppearances are always exact regardless
 *                           of this cap - only the detailed per-appearance list is truncated.
 *   CHECKPOINT_EVERY        blocks between checkpoint writes (default: 200)
 *   OUTPUT_FILE             resumable JSON checkpoint (default: bboard-cli/preprod-address-activity.json)
 *   ADDRESSES_CSV           CSV export path (default: bboard-cli/preprod-addresses.csv)
 *   ADDRESSES_TXT           plain address-per-line export path (default: bboard-cli/preprod-addresses.txt)
 *   VERIFICATION_FILE       sample verification queries for the top addresses
 *                           (default: bboard-cli/preprod-addresses-verification.txt)
 *   RESUME                  "false" to ignore any existing checkpoint (default: true)
 *
 * The script checkpoints to OUTPUT_FILE periodically and on SIGINT (Ctrl+C); CSV/TXT/
 * verification exports are (re)written whenever the scan stops, whether by completing,
 * hitting STOP_AT_ADDRESS_COUNT, or being interrupted - so partial results are always usable.
 */

import fs from 'node:fs';
import path from 'node:path';
import { currentDir } from '../config.js';
import { createLogger } from '../logger-utils.js';

const INDEXER_URL = process.env.MIDNIGHT_INDEXER_URL ?? 'https://indexer.preprod.midnight.network/api/v4/graphql';
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS ?? 20_000);
const REQUEST_INTERVAL_MS = Number(process.env.REQUEST_INTERVAL_MS ?? 350);
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 4);
const MAX_RETRIES = Number(process.env.MAX_RETRIES ?? 5);
const MAX_STORED_APPEARANCES = Number(process.env.MAX_STORED_APPEARANCES ?? 25);
const CHECKPOINT_EVERY = Number(process.env.CHECKPOINT_EVERY ?? 200);
const STOP_AT_ADDRESS_COUNT = Number(process.env.STOP_AT_ADDRESS_COUNT ?? 0);
const OUTPUT_FILE = process.env.OUTPUT_FILE ?? path.resolve(currentDir, '..', 'preprod-address-activity.json');
const ADDRESSES_CSV = process.env.ADDRESSES_CSV ?? path.resolve(currentDir, '..', 'preprod-addresses.csv');
const ADDRESSES_TXT = process.env.ADDRESSES_TXT ?? path.resolve(currentDir, '..', 'preprod-addresses.txt');
const VERIFICATION_FILE =
  process.env.VERIFICATION_FILE ?? path.resolve(currentDir, '..', 'preprod-addresses-verification.txt');
const RESUME = (process.env.RESUME ?? 'true').toLowerCase() !== 'false';

// --- GraphQL documents, using only fields verified against the installed indexer schema ---

const LATEST_HEIGHT_QUERY = /* GraphQL */ `
  query LatestHeight {
    block {
      height
      timestamp
    }
  }
`;

const BLOCK_TIMESTAMP_QUERY = /* GraphQL */ `
  query BlockTimestamp($height: Int!) {
    block(offset: { height: $height }) {
      height
      timestamp
    }
  }
`;

const BLOCK_OWNERS_QUERY = /* GraphQL */ `
  query BlockOwners($height: Int!) {
    block(offset: { height: $height }) {
      height
      hash
      author
      transactions {
        hash
        unshieldedCreatedOutputs {
          owner
        }
        unshieldedSpentOutputs {
          owner
        }
        contractActions {
          address
        }
      }
    }
  }
`;

interface UnshieldedUtxoOwner {
  readonly owner: string;
}

interface ContractActionAddress {
  readonly address: string;
}

interface BlockOwnersTransaction {
  readonly hash: string;
  readonly unshieldedCreatedOutputs: readonly UnshieldedUtxoOwner[];
  readonly unshieldedSpentOutputs: readonly UnshieldedUtxoOwner[];
  readonly contractActions: readonly ContractActionAddress[];
}

interface BlockOwnersResult {
  readonly block: {
    readonly height: number;
    readonly hash: string;
    readonly author: string | null;
    readonly transactions: readonly BlockOwnersTransaction[];
  } | null;
}

interface LatestHeightResult {
  readonly block: { readonly height: number; readonly timestamp: number } | null;
}

interface BlockTimestampResult {
  readonly block: { readonly height: number; readonly timestamp: number } | null;
}

interface GraphQLResponse<T> {
  readonly data?: T;
  readonly errors?: ReadonlyArray<{ message: string }>;
}

type UtxoRole = 'created' | 'spent';

interface AddressAppearance {
  txHash: string;
  height: number;
  role: UtxoRole;
}

interface AddressRecord {
  address: string;
  firstSeenHeight: number;
  lastSeenHeight: number;
  createdCount: number;
  spentCount: number;
  appearances: AddressAppearance[];
}

interface Checkpoint {
  network: 'preprod';
  indexerUrl: string;
  startHeight: number;
  endHeight: number;
  lastScannedHeight: number;
  blocksScanned: number;
  transactionsScanned: number;
  addresses: Record<string, AddressRecord>;
  uniqueContractAddresses: string[];
  uniqueBlockAuthors: string[];
  updatedAt: string;
  complete: boolean;
  stoppedAtAddressCountTarget: number | null;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Enforces a minimum spacing between request starts, shared across all concurrent workers.
 * This is a single-threaded, synchronous read-modify-write of `nextRequestAt` (no await between
 * reading and updating it), so it's race-free despite being called from multiple concurrent
 * `worker()` loops.
 */
let nextRequestAt = 0;
async function throttle(): Promise<void> {
  const now = Date.now();
  const scheduledAt = Math.max(now, nextRequestAt);
  nextRequestAt = scheduledAt + REQUEST_INTERVAL_MS;
  const delay = scheduledAt - now;
  if (delay > 0) {
    await sleep(delay);
  }
}

async function graphqlRequest<T>(query: string, variables: Record<string, unknown> | undefined, logger: Logger): Promise<T> {
  let attempt = 0;
  let lastError: unknown;
  while (attempt < MAX_RETRIES) {
    await throttle();
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(new Error(`Request timed out after ${REQUEST_TIMEOUT_MS}ms`)), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(INDEXER_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query, variables }),
        signal: abortController.signal,
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      const body = (await res.json()) as GraphQLResponse<T>;
      if (body.errors && body.errors.length > 0) {
        throw new Error(`GraphQL error: ${body.errors.map((e) => e.message).join('; ')}`);
      }
      if (body.data === undefined) {
        throw new Error('GraphQL response had no data');
      }
      return body.data;
    } catch (e) {
      lastError = e;
      attempt += 1;
      const message = (e as Error).message;
      // A 403 from this indexer indicates a WAF/rate-limit block, not an ordinary transient
      // failure - back off much longer so we don't hammer straight back into the same block.
      const isRateLimited = message.includes('403');
      const backoffMs = isRateLimited ? Math.min(30_000 * 2 ** attempt, 180_000) : Math.min(1000 * 2 ** attempt, 15_000);
      logger.warn(`Request failed (attempt ${attempt}/${MAX_RETRIES}): ${message}. Retrying in ${backoffMs}ms...`);
      await sleep(backoffMs);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Unknown GraphQL request failure');
}

type Logger = { info: (msg: string) => void; warn: (msg: string) => void; error: (msg: string) => void };

async function getLatestBlock(logger: Logger): Promise<{ height: number; timestampMs: number }> {
  const data = await graphqlRequest<LatestHeightResult>(LATEST_HEIGHT_QUERY, undefined, logger);
  if (data.block === null) {
    throw new Error('Indexer returned no latest block - is the network reachable?');
  }
  return { height: data.block.height, timestampMs: data.block.timestamp };
}

/**
 * Measures the real average block time by sampling a block SAMPLE_GAP heights behind the
 * chain tip (rather than assuming a constant), then converts LOOKBACK_DAYS into a starting
 * height. `Block.timestamp` from the indexer is Unix milliseconds.
 */
async function resolveLookbackStartHeight(
  latestHeight: number,
  latestTimestampMs: number,
  lookbackDays: number,
  logger: Logger,
): Promise<number> {
  const SAMPLE_GAP = Math.min(10_000, latestHeight);
  const sampleHeight = latestHeight - SAMPLE_GAP;
  const data = await graphqlRequest<BlockTimestampResult>(BLOCK_TIMESTAMP_QUERY, { height: sampleHeight }, logger);
  if (data.block === null || SAMPLE_GAP === 0) {
    logger.warn('Could not sample a reference block for block-time estimation; falling back to height 0.');
    return 0;
  }
  const elapsedMs = latestTimestampMs - data.block.timestamp;
  const avgBlockTimeMs = elapsedMs / SAMPLE_GAP;
  const lookbackMs = lookbackDays * 24 * 60 * 60 * 1000;
  const blocksBack = Math.ceil(lookbackMs / avgBlockTimeMs);
  const startHeight = Math.max(0, latestHeight - blocksBack);
  logger.info(
    `Measured average block time: ${(avgBlockTimeMs / 1000).toFixed(2)}s (sampled over last ${SAMPLE_GAP} blocks). ` +
      `LOOKBACK_DAYS=${lookbackDays} => scanning from height ${startHeight} (~${blocksBack} blocks back).`,
  );
  return startHeight;
}

function loadCheckpoint(): Checkpoint | undefined {
  if (!RESUME || !fs.existsSync(OUTPUT_FILE)) {
    return undefined;
  }
  try {
    return JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8')) as Checkpoint;
  } catch {
    return undefined;
  }
}

function writeCheckpoint(checkpoint: Checkpoint): void {
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(checkpoint, null, 2));
}

function recordCount(record: AddressRecord): number {
  return record.createdCount + record.spentCount;
}

function sortedRecords(addresses: Record<string, AddressRecord>): AddressRecord[] {
  return Object.values(addresses).sort((a, b) => {
    const byCount = recordCount(b) - recordCount(a);
    if (byCount !== 0) return byCount;
    return a.firstSeenHeight - b.firstSeenHeight;
  });
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function verificationQuery(txHash: string): string {
  const query = `query{transactions(offset:{hash:"${txHash}"}){hash unshieldedCreatedOutputs{owner value tokenType} unshieldedSpentOutputs{owner value tokenType} block{height}}}`;
  return (
    `curl -s -X POST ${INDEXER_URL} -H 'content-type: application/json' ` +
    `-d '${JSON.stringify({ query })}'`
  );
}

/**
 * Writes the CSV/TXT/verification exports from the current in-memory address map. Called
 * whenever the scan stops (completion, STOP_AT_ADDRESS_COUNT reached, or interruption) so the
 * exports always reflect whatever was actually, verifiably observed - never padded.
 */
function exportResults(addresses: Record<string, AddressRecord>, logger: Logger): void {
  const sorted = sortedRecords(addresses);

  const csvHeader = [
    'address',
    'total_appearances',
    'created_count',
    'spent_count',
    'first_seen_height',
    'last_seen_height',
    'tx_hashes',
  ].join(',');
  const csvRows = sorted.map((r) => {
    const hashes = r.appearances.map((a) => `${a.txHash}(${a.role}@${a.height})`).join(';');
    return [
      csvEscape(r.address),
      String(recordCount(r)),
      String(r.createdCount),
      String(r.spentCount),
      String(r.firstSeenHeight),
      String(r.lastSeenHeight),
      csvEscape(hashes),
    ].join(',');
  });
  fs.writeFileSync(ADDRESSES_CSV, [csvHeader, ...csvRows].join('\n') + '\n');

  fs.writeFileSync(ADDRESSES_TXT, sorted.map((r) => r.address).join('\n') + (sorted.length > 0 ? '\n' : ''));

  const sampleSize = Math.min(5, sorted.length);
  const verificationLines: string[] = [
    `Sample independent-verification queries for the ${sampleSize} most active addresses found.`,
    `Run each curl command yourself against the real Preprod indexer (${INDEXER_URL});`,
    `the address will appear as the "owner" field in the JSON response, proving the`,
    `transaction genuinely exists on-chain and involves that address.`,
    '',
  ];
  for (const r of sorted.slice(0, sampleSize)) {
    const sampleTxHash = r.appearances[0]?.txHash;
    verificationLines.push(`# ${r.address} (first seen block ${r.firstSeenHeight}, ${recordCount(r)} appearance(s))`);
    if (sampleTxHash !== undefined) {
      verificationLines.push(verificationQuery(sampleTxHash));
    } else {
      verificationLines.push('# (no stored tx hash for this address - see the CSV for full appearance detail)');
    }
    verificationLines.push('');
  }
  fs.writeFileSync(VERIFICATION_FILE, verificationLines.join('\n'));

  logger.info(`Exported ${sorted.length} verified addresses to:`);
  logger.info(`  CSV:          ${ADDRESSES_CSV}`);
  logger.info(`  TXT:          ${ADDRESSES_TXT}`);
  logger.info(`  Verification: ${VERIFICATION_FILE}`);
}

async function main(): Promise<void> {
  const logger = await createLogger(path.resolve(currentDir, '..', 'logs', 'scan-preprod-addresses', `${new Date().toISOString()}.log`));

  const latest = await getLatestBlock(logger);
  const latestHeight = latest.height;
  logger.info(`Preprod indexer at ${INDEXER_URL}, current chain tip is block height ${latestHeight}.`);

  const existing = loadCheckpoint();

  // If we're resuming a previous run (a checkpoint exists and the caller didn't explicitly
  // override the range), keep pinned to *that* checkpoint's original endHeight. Otherwise a
  // LOOKBACK_DAYS window re-derived from "now" on every invocation would drift forward each
  // time this is re-run, and the resume-from-checkpoint branch below would never match.
  const endHeight =
    process.env.END_HEIGHT !== undefined
      ? Number(process.env.END_HEIGHT)
      : existing !== undefined && process.env.START_HEIGHT === undefined
        ? existing.endHeight
        : latestHeight;

  let startHeight: number;
  if (process.env.START_HEIGHT !== undefined) {
    startHeight = Number(process.env.START_HEIGHT);
  } else if (existing !== undefined && existing.endHeight === endHeight) {
    startHeight = existing.lastScannedHeight + 1;
    logger.info(`Resuming previous scan from height ${startHeight} (checkpoint found at ${OUTPUT_FILE}).`);
  } else if (process.env.LOOKBACK_DAYS !== undefined) {
    startHeight = await resolveLookbackStartHeight(latestHeight, latest.timestampMs, Number(process.env.LOOKBACK_DAYS), logger);
  } else {
    startHeight = 0;
    logger.warn(
      `No START_HEIGHT or LOOKBACK_DAYS given: scanning the ENTIRE chain from genesis (height 0) to ${endHeight}. ` +
        `At ~6s/block this is the full history (${((endHeight * 6) / 86400).toFixed(1)} days of chain time, ` +
        `${endHeight} blocks / requests) and can take many hours. Consider setting LOOKBACK_DAYS (e.g. LOOKBACK_DAYS=7) ` +
        `for a recent-activity window, or Ctrl+C any time - progress is checkpointed and resumable.`,
    );
  }

  const addresses: Record<string, AddressRecord> = existing?.addresses ?? {};
  const uniqueContractAddresses = new Set<string>(existing?.uniqueContractAddresses ?? []);
  const uniqueBlockAuthors = new Set<string>(existing?.uniqueBlockAuthors ?? []);
  let blocksScanned = existing?.blocksScanned ?? 0;
  let transactionsScanned = existing?.transactionsScanned ?? 0;

  if (STOP_AT_ADDRESS_COUNT > 0) {
    logger.info(`STOP_AT_ADDRESS_COUNT=${STOP_AT_ADDRESS_COUNT}: will stop as soon as that many distinct addresses are observed.`);
  }

  let lastScannedHeight = existing?.lastScannedHeight ?? startHeight - 1;
  let sinceCheckpoint = 0;
  let interrupted = false;
  let stoppedAtAddressCountTarget: number | null = null;

  const alreadyAtTarget = STOP_AT_ADDRESS_COUNT > 0 && Object.keys(addresses).length >= STOP_AT_ADDRESS_COUNT;
  if (alreadyAtTarget) {
    logger.info(`Checkpoint already has ${Object.keys(addresses).length} addresses, meeting STOP_AT_ADDRESS_COUNT=${STOP_AT_ADDRESS_COUNT}. Skipping scan.`);
    stoppedAtAddressCountTarget = STOP_AT_ADDRESS_COUNT;
  } else if (startHeight > endHeight) {
    logger.info(`Nothing to scan: startHeight (${startHeight}) > endHeight (${endHeight}). Already complete?`);
  } else {
    logger.info(
      `Scanning blocks [${startHeight}, ${endHeight}] (${endHeight - startHeight + 1} blocks) with concurrency=${CONCURRENCY}...`,
    );
  }

  const writeNow = (complete: boolean): void => {
    writeCheckpoint({
      network: 'preprod',
      indexerUrl: INDEXER_URL,
      startHeight: existing?.startHeight ?? startHeight,
      endHeight,
      lastScannedHeight,
      blocksScanned,
      transactionsScanned,
      addresses,
      uniqueContractAddresses: [...uniqueContractAddresses],
      uniqueBlockAuthors: [...uniqueBlockAuthors],
      updatedAt: new Date().toISOString(),
      complete,
      stoppedAtAddressCountTarget,
    });
  };

  process.on('SIGINT', () => {
    interrupted = true;
    logger.warn('Interrupted - writing checkpoint and exports before exit...');
    writeNow(false);
    exportResults(addresses, logger);
    logger.info(`Checkpoint saved to ${OUTPUT_FILE}. Re-run the same command to resume from height ${lastScannedHeight + 1}.`);
    process.exit(130);
  });

  const recordAppearance = (owner: string, txHash: string, height: number, role: UtxoRole): void => {
    let record = addresses[owner];
    if (record === undefined) {
      record = { address: owner, firstSeenHeight: height, lastSeenHeight: height, createdCount: 0, spentCount: 0, appearances: [] };
      addresses[owner] = record;
    }
    record.firstSeenHeight = Math.min(record.firstSeenHeight, height);
    record.lastSeenHeight = Math.max(record.lastSeenHeight, height);
    if (role === 'created') {
      record.createdCount += 1;
    } else {
      record.spentCount += 1;
    }
    if (record.appearances.length < MAX_STORED_APPEARANCES) {
      record.appearances.push({ txHash, height, role });
    }
  };

  let nextHeight = startHeight;
  const worker = async (): Promise<void> => {
    while (!interrupted && nextHeight <= endHeight) {
      if (STOP_AT_ADDRESS_COUNT > 0 && Object.keys(addresses).length >= STOP_AT_ADDRESS_COUNT) {
        stoppedAtAddressCountTarget = STOP_AT_ADDRESS_COUNT;
        interrupted = true;
        break;
      }
      const height = nextHeight;
      nextHeight += 1;

      const data = await graphqlRequest<BlockOwnersResult>(BLOCK_OWNERS_QUERY, { height }, logger);
      if (data.block === null) {
        logger.warn(`No block found at height ${height} (skipped).`);
        continue;
      }
      const block = data.block;
      if (block.author) {
        uniqueBlockAuthors.add(block.author);
      }
      for (const tx of block.transactions) {
        transactionsScanned += 1;
        for (const utxo of tx.unshieldedCreatedOutputs) {
          recordAppearance(utxo.owner, tx.hash, height, 'created');
        }
        for (const utxo of tx.unshieldedSpentOutputs) {
          recordAppearance(utxo.owner, tx.hash, height, 'spent');
        }
        for (const action of tx.contractActions) {
          uniqueContractAddresses.add(action.address);
        }
      }
      blocksScanned += 1;
      lastScannedHeight = Math.max(lastScannedHeight, height);
      sinceCheckpoint += 1;

      if (sinceCheckpoint >= CHECKPOINT_EVERY) {
        sinceCheckpoint = 0;
        writeNow(false);
        logger.info(
          `Progress: height ${height}/${endHeight} | blocks=${blocksScanned} txs=${transactionsScanned} ` +
            `uniqueAddresses=${Object.keys(addresses).length} uniqueContractAddresses=${uniqueContractAddresses.size}`,
        );
      }
    }
  };

  if (!alreadyAtTarget) {
    const workers = Array.from({ length: Math.max(1, CONCURRENCY) }, () => worker());
    await Promise.all(workers);
  }

  writeNow(true);
  exportResults(addresses, logger);

  logger.info('=== Scan complete ===');
  logger.info(`Height range scanned: [${existing?.startHeight ?? startHeight}, ${lastScannedHeight}]`);
  logger.info(`Blocks scanned: ${blocksScanned}`);
  logger.info(`Transactions scanned: ${transactionsScanned}`);
  logger.info(`Distinct verified unshielded addresses: ${Object.keys(addresses).length}`);
  if (stoppedAtAddressCountTarget !== null) {
    logger.info(`Stopped early: reached STOP_AT_ADDRESS_COUNT=${stoppedAtAddressCountTarget}.`);
  }
  if (Object.keys(addresses).length < 50) {
    logger.warn(`Only ${Object.keys(addresses).length} distinct addresses were verified in the scanned range - fewer than 50.`);
  }
  logger.info(`Unique contract addresses interacted with: ${uniqueContractAddresses.size} (excluded from address export)`);
  logger.info(`Unique block-producing validator addresses: ${uniqueBlockAuthors.size} (excluded from address export)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
