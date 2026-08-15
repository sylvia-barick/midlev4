import {
  SplitsAPI,
  type SplitsCircuitKeys,
  type SplitsProviders,
  type SplitsPrivateState,
} from '../../../api/src/index';
import { type ContractAddress, fromHex, toHex } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import {
  BehaviorSubject,
  filter,
  firstValueFrom,
  interval,
  map,
  type Observable,
  take,
  tap,
  timeout,
  concatMap,
  from,
} from 'rxjs';
import { pipe as fnPipe } from 'fp-ts/function';
import { type Logger } from 'pino';
import { ConnectedAPI, type InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import {
  Binding,
  FinalizedTransaction,
  Proof,
  SignatureEnabled,
  Transaction,
  TransactionId,
} from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { inMemoryPrivateStateProvider } from '../in-memory-private-state-provider';
import { setNetworkId, NetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import type { UnboundTransaction } from '@midnight-ntwrk/midnight-js-types';

export interface InProgressSplitsDeployment {
  readonly status: 'in-progress';
}

export interface DeployedSplitsDeployment {
  readonly status: 'deployed';
  readonly api: SplitsAPI;
}

export interface FailedSplitsDeployment {
  readonly status: 'failed';
  readonly error: Error;
}

export type SplitsDeployment = InProgressSplitsDeployment | DeployedSplitsDeployment | FailedSplitsDeployment;

export interface DeployedSplitsAPIProvider {
  readonly splitsDeployments$: Observable<Array<Observable<SplitsDeployment>>>;
  readonly resolve: (contractAddress?: ContractAddress, initialMembers?: Uint8Array[]) => Observable<SplitsDeployment>;
}

export class BrowserDeployedSplitsManager implements DeployedSplitsAPIProvider {
  readonly #splitsDeploymentsSubject: BehaviorSubject<Array<BehaviorSubject<SplitsDeployment>>>;
  #initializedProviders: Promise<SplitsProviders> | undefined;

  constructor(private readonly logger: Logger) {
    this.#splitsDeploymentsSubject = new BehaviorSubject<Array<BehaviorSubject<SplitsDeployment>>>([]);
    this.splitsDeployments$ = this.#splitsDeploymentsSubject;
  }

  readonly splitsDeployments$: Observable<Array<Observable<SplitsDeployment>>>;

  resolve(contractAddress?: ContractAddress, initialMembers?: Uint8Array[]): Observable<SplitsDeployment> {
    const deployments = this.#splitsDeploymentsSubject.value;
    let deployment = deployments.find(
      (deployment) =>
        deployment.value.status === 'deployed' && deployment.value.api.deployedContractAddress === contractAddress,
    );

    if (deployment) {
      return deployment;
    }

    deployment = new BehaviorSubject<SplitsDeployment>({
      status: 'in-progress',
    });

    if (contractAddress) {
      void this.joinDeployment(deployment, contractAddress);
    } else {
      void this.deployDeployment(deployment, initialMembers || []);
    }

    this.#splitsDeploymentsSubject.next([...deployments, deployment]);

    return deployment;
  }

  private getProviders(): Promise<SplitsProviders> {
    return this.#initializedProviders ?? (this.#initializedProviders = initializeProviders(this.logger));
  }

  private async deployDeployment(
    deployment: BehaviorSubject<SplitsDeployment>,
    initialMembers: Uint8Array[],
  ): Promise<void> {
    try {
      const providers = await this.getProviders();
      const api = await SplitsAPI.deploy(providers, initialMembers, this.logger);

      deployment.next({
        status: 'deployed',
        api,
      });
    } catch (error: unknown) {
      deployment.next({
        status: 'failed',
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  private async joinDeployment(
    deployment: BehaviorSubject<SplitsDeployment>,
    contractAddress: ContractAddress,
  ): Promise<void> {
    try {
      const providers = await this.getProviders();
      const api = await SplitsAPI.join(providers, contractAddress, this.logger);

      deployment.next({
        status: 'deployed',
        api,
      });
    } catch (error: unknown) {
      deployment.next({
        status: 'failed',
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }
}

const initializeProviders = async (logger: Logger): Promise<SplitsProviders> => {
  const networkId = import.meta.env.VITE_NETWORK_ID as NetworkId;
  setNetworkId(networkId);
  const connectedAPI = await connectToWallet(logger, networkId);
  const zkConfigPath = window.location.origin;
  const keyMaterialProvider = new FetchZkConfigProvider<SplitsCircuitKeys>(zkConfigPath, fetch.bind(window));
  const config = await connectedAPI.getConfiguration();
  const inMemorySplitsPrivateStateProvider = inMemoryPrivateStateProvider<string, SplitsPrivateState>();
  const shieldedAddresses = await connectedAPI.getShieldedAddresses();

  return {
    privateStateProvider: inMemorySplitsPrivateStateProvider,
    zkConfigProvider: keyMaterialProvider,
    proofProvider: httpClientProofProvider(config.proverServerUri!, keyMaterialProvider),
    publicDataProvider: indexerPublicDataProvider(config.indexerUri, config.indexerWsUri),
    walletProvider: {
      getCoinPublicKey(): string {
        return shieldedAddresses.shieldedCoinPublicKey;
      },
      getEncryptionPublicKey(): string {
        return shieldedAddresses.shieldedEncryptionPublicKey;
      },
      balanceTx: async (tx: UnboundTransaction, ttl?: Date): Promise<FinalizedTransaction> => {
        try {
          logger.info({ tx, ttl }, 'Balancing Splits transaction via wallet');
          const serializedTx = toHex(tx.serialize());
          const received = await connectedAPI.balanceUnsealedTransaction(serializedTx);
          return Transaction.deserialize<SignatureEnabled, Proof, Binding>(
            'signature',
            'proof',
            'binding',
            fromHex(received.tx),
          );
        } catch (e) {
          logger.error({ error: e }, 'Error balancing Splits transaction via wallet');
          throw e;
        }
      },
    },
    midnightProvider: {
      submitTx: async (tx: FinalizedTransaction): Promise<TransactionId> => {
        await connectedAPI.submitTransaction(toHex(tx.serialize()));
        const txIdentifiers = tx.identifiers();
        const txId = txIdentifiers[0];
        logger.info({ txIdentifiers }, 'Submitted Splits transaction via wallet');
        return txId;
      },
    },
  };
};

const getFirstCompatibleWallet = (): InitialAPI | undefined => {
  if (!window.midnight) return undefined;
  return window.midnight['1am'];
};

const connectToWallet = (logger: Logger, networkId: string): Promise<ConnectedAPI> => {
  return firstValueFrom(
    fnPipe(
      interval(100),
      map(() => getFirstCompatibleWallet()),
      tap((connectorAPI) => {
        logger.info(connectorAPI, 'Check for 1AM wallet connector API');
      }),
      filter((connectorAPI): connectorAPI is InitialAPI => !!connectorAPI),
      tap((connectorAPI) => {
        logger.info(connectorAPI, '1AM wallet connector API found. Connecting.');
      }),
      take(1),
      timeout({
        first: 5_000,
        with: () => {
          throw new Error('1AM Wallet connector not detected or injection timed out.');
        },
      }),
      map((connectorAPI) => connectorAPI.connect(networkId)),
      concatMap((promise) => from(promise)),
    ),
  );
};
