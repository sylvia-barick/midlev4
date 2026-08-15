import * as Splits from '../../contract/src/managed/splits/contract/index.js';
import { type ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { type Logger } from 'pino';
import { CompiledSplitsContractContract, type SplitsPrivateState } from '../../contract/src/index.js';
export { type SplitsPrivateState };
import { deployContract, findDeployedContract, type FoundContract } from '@midnight-ntwrk/midnight-js-contracts';
import { combineLatest, map, tap, from, type Observable } from 'rxjs';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';
import { type MidnightProviders } from '@midnight-ntwrk/midnight-js-types';
import * as utils from './utils/index.js';

export const splitsPrivateStateKey = 'splitsPrivateState';
export type SplitsPrivateStateId = typeof splitsPrivateStateKey;

export type SplitsCircuitKeys = Exclude<keyof Splits.Contract<SplitsPrivateState>['impureCircuits'], number | symbol>;
export type SplitsProviders = MidnightProviders<SplitsCircuitKeys, SplitsPrivateStateId, SplitsPrivateState>;
export type DeployedSplitsContract = FoundContract<Splits.Contract<SplitsPrivateState>>;

export interface SplitsDerivedState {
  readonly members: string[];
  readonly balance_commitments: string[];
  readonly pending_expense_amount: bigint;
  readonly pending_expense_payer_idx: bigint;
  readonly pending_expense_shares: bigint[];
  readonly synced_mask: boolean[];
  readonly pending_payment_from: bigint;
  readonly pending_payment_to: bigint;
  readonly pending_payment_amount: bigint;
  readonly pending_payment_status: bigint;
  
  // Local private user contexts
  readonly activeIdx: number;
  readonly balances: { [idx: number]: bigint };
  readonly salts: { [idx: number]: string };
}

export function createSplitsPrivateState(secretKey: Uint8Array): SplitsPrivateState {
  return {
    secretKey,
    balances: { 0: 0n, 1: 0n, 2: 0n, 3: 0n },
    salts: {
      0: new Uint8Array(32),
      1: new Uint8Array(32),
      2: new Uint8Array(32),
      3: new Uint8Array(32),
    },
    activeIdx: 0,
  };
}

export class SplitsAPI {
  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<SplitsDerivedState>;

  constructor(
    public readonly deployedContract: DeployedSplitsContract,
    private readonly providers: SplitsProviders,
    private readonly logger?: Logger,
  ) {
    this.deployedContractAddress = deployedContract.deployTxData.public.contractAddress;
    providers.privateStateProvider.setContractAddress(this.deployedContractAddress);

    this.state$ = combineLatest(
      [
        providers.publicDataProvider.contractStateObservable(this.deployedContractAddress, { type: 'latest' }).pipe(
          map((contractState) => Splits.ledger(contractState.data)),
          tap((ledgerState) => {
            logger?.trace({
              ledgerStateChanged: {
                members: ledgerState.members.map(toHex),
                balance_commitments: ledgerState.balance_commitments.map(toHex),
                pending_expense_amount: ledgerState.pending_expense_amount,
                pending_payment_status: ledgerState.pending_payment_status,
              },
            });
          }),
        ),
        from(providers.privateStateProvider.get(splitsPrivateStateKey) as Promise<SplitsPrivateState | undefined>),
      ],
      (ledgerState, privateState) => {
        const activePrivateState = privateState ?? createSplitsPrivateState(utils.randomBytes(32));
        
        const saltsHex: { [idx: number]: string } = {};
        for (let i = 0; i < 4; i++) {
          saltsHex[i] = toHex(activePrivateState.salts[i] || new Uint8Array(32));
        }

        return {
          members: ledgerState.members.map(toHex),
          balance_commitments: ledgerState.balance_commitments.map(toHex),
          pending_expense_amount: ledgerState.pending_expense_amount,
          pending_expense_payer_idx: ledgerState.pending_expense_payer_idx,
          pending_expense_shares: Array.from(ledgerState.pending_expense_shares),
          synced_mask: Array.from(ledgerState.synced_mask),
          pending_payment_from: ledgerState.pending_payment_from,
          pending_payment_to: ledgerState.pending_payment_to,
          pending_payment_amount: ledgerState.pending_payment_amount,
          pending_payment_status: ledgerState.pending_payment_status,
          activeIdx: activePrivateState.activeIdx,
          balances: activePrivateState.balances,
          salts: saltsHex,
        };
      },
    );
  }

  static async deploy(providers: SplitsProviders, initialMembers: Uint8Array[], logger?: Logger): Promise<SplitsAPI> {
    logger?.info('deploySplitsContract');

    const paddedMembers: Uint8Array[] = [
      initialMembers[0] || new Uint8Array(32),
      initialMembers[1] || new Uint8Array(32),
      initialMembers[2] || new Uint8Array(32),
      initialMembers[3] || new Uint8Array(32),
    ];

    const deployedSplitsContract = await deployContract<Splits.Contract<SplitsPrivateState>>(providers, {
      compiledContract: CompiledSplitsContractContract,
      privateStateId: splitsPrivateStateKey,
      initialPrivateState: createSplitsPrivateState(utils.randomBytes(32)),
      args: [paddedMembers as any],
    });

    logger?.trace({
      contractDeployed: {
        finalizedDeployTxData: deployedSplitsContract.deployTxData.public,
      },
    });

    return new SplitsAPI(deployedSplitsContract, providers, logger);
  }

  static async join(providers: SplitsProviders, contractAddress: ContractAddress, logger?: Logger): Promise<SplitsAPI> {
    logger?.info({
      joinSplitsContract: {
        contractAddress,
      },
    });

    const deployedSplitsContract = await findDeployedContract<Splits.Contract<SplitsPrivateState>>(providers, {
      contractAddress,
      compiledContract: CompiledSplitsContractContract,
      privateStateId: splitsPrivateStateKey,
      initialPrivateState: await SplitsAPI.getPrivateState(providers, contractAddress),
    });

    logger?.trace({
      contractJoined: {
        finalizedDeployTxData: deployedSplitsContract.deployTxData.public,
      },
    });

    return new SplitsAPI(deployedSplitsContract, providers, logger);
  }

  private static async getPrivateState(
    providers: SplitsProviders,
    contractAddress: ContractAddress,
  ): Promise<SplitsPrivateState> {
    providers.privateStateProvider.setContractAddress(contractAddress);
    const existingPrivateState = await providers.privateStateProvider.get(splitsPrivateStateKey);
    return existingPrivateState ?? createSplitsPrivateState(utils.randomBytes(32));
  }

  async changeActiveUser(idx: number, secretKey: Uint8Array): Promise<void> {
    const privateState = await this.providers.privateStateProvider.get(splitsPrivateStateKey);
    const activePrivateState = privateState ?? createSplitsPrivateState(utils.randomBytes(32));

    await this.providers.privateStateProvider.set(splitsPrivateStateKey, {
      ...activePrivateState,
      secretKey,
      activeIdx: idx,
    });
  }

  async postExpense(payerIdx: bigint, amount: bigint, shares: bigint[]): Promise<void> {
    this.logger?.info({ postExpense: { payerIdx, amount, shares } });
    
    const paddedShares = [
      shares[0] || 0n,
      shares[1] || 0n,
      shares[2] || 0n,
      shares[3] || 0n,
    ];

    const txData = await this.deployedContract.callTx.post_expense(payerIdx, amount, paddedShares as any);
    this.logger?.trace({ postExpenseTx: txData.public.txHash });
  }

  async syncBalance(idx: number, currentLedgerState: SplitsDerivedState): Promise<void> {
    this.logger?.info({ syncBalance: { idx } });

    const privateState = await this.providers.privateStateProvider.get(splitsPrivateStateKey);
    const activePrivateState = privateState ?? createSplitsPrivateState(utils.randomBytes(32));

    const oldBalance = activePrivateState.balances[idx] ?? 0n;
    const oldSalt = activePrivateState.salts[idx] ?? new Uint8Array(32);
    const newSalt = utils.randomBytes(32);

    const txData = await this.deployedContract.callTx.sync_balance(
      BigInt(idx),
      oldBalance,
      oldSalt,
      newSalt
    );
    this.logger?.trace({ syncBalanceTx: txData.public.txHash });

    // Calculate new balance
    const share = currentLedgerState.pending_expense_shares[idx] || 0n;
    let change = 0n;
    if (BigInt(idx) === currentLedgerState.pending_expense_payer_idx) {
      change = currentLedgerState.pending_expense_amount - share;
    } else {
      change = 0n - share;
    }
    const newBalance = oldBalance + change;

    const nextBalances = { ...activePrivateState.balances, [idx]: newBalance };
    const nextSalts = { ...activePrivateState.salts, [idx]: newSalt };

    await this.providers.privateStateProvider.set(splitsPrivateStateKey, {
      ...activePrivateState,
      balances: nextBalances,
      salts: nextSalts,
    });
  }

  async postPayment(debtorIdx: number, creditorIdx: number, amount: bigint): Promise<void> {
    this.logger?.info({ postPayment: { debtorIdx, creditorIdx, amount } });

    const privateState = await this.providers.privateStateProvider.get(splitsPrivateStateKey);
    const activePrivateState = privateState ?? createSplitsPrivateState(utils.randomBytes(32));

    const oldBalance = activePrivateState.balances[debtorIdx] ?? 0n;
    const oldSalt = activePrivateState.salts[debtorIdx] ?? new Uint8Array(32);
    const newSalt = utils.randomBytes(32);

    const txData = await this.deployedContract.callTx.post_payment(
      BigInt(debtorIdx),
      BigInt(creditorIdx),
      amount,
      oldBalance,
      oldSalt,
      newSalt
    );
    this.logger?.trace({ postPaymentTx: txData.public.txHash });

    const nextBalances = { ...activePrivateState.balances, [debtorIdx]: oldBalance + amount };
    const nextSalts = { ...activePrivateState.salts, [debtorIdx]: newSalt };

    await this.providers.privateStateProvider.set(splitsPrivateStateKey, {
      ...activePrivateState,
      balances: nextBalances,
      salts: nextSalts,
    });
  }

  async claimPayment(currentLedgerState: SplitsDerivedState): Promise<void> {
    this.logger?.info('claimPayment');

    const privateState = await this.providers.privateStateProvider.get(splitsPrivateStateKey);
    const activePrivateState = privateState ?? createSplitsPrivateState(utils.randomBytes(32));

    const creditorIdx = Number(currentLedgerState.pending_payment_to);
    const oldBalance = activePrivateState.balances[creditorIdx] ?? 0n;
    const oldSalt = activePrivateState.salts[creditorIdx] ?? new Uint8Array(32);
    const newSalt = utils.randomBytes(32);

    const txData = await this.deployedContract.callTx.claim_payment(
      oldBalance,
      oldSalt,
      newSalt
    );
    this.logger?.trace({ claimPaymentTx: txData.public.txHash });

    const amount = currentLedgerState.pending_payment_amount;
    const nextBalances = { ...activePrivateState.balances, [creditorIdx]: oldBalance - amount };
    const nextSalts = { ...activePrivateState.salts, [creditorIdx]: newSalt };

    await this.providers.privateStateProvider.set(splitsPrivateStateKey, {
      ...activePrivateState,
      balances: nextBalances,
      salts: nextSalts,
    });
  }

  async joinGroup(idx: number): Promise<void> {
    this.logger?.info({ joinGroup: { idx } });
    const txData = await this.deployedContract.callTx.join_group(BigInt(idx));
    this.logger?.trace({ joinGroupTx: txData.public.txHash });
  }
}
