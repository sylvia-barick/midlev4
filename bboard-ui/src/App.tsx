import React, { useEffect, useState, useContext } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Alert,
  Paper,
  Divider,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Chip,
  Stack,
  Snackbar,
  LinearProgress,
  Skeleton,
  Fade,
} from '@mui/material';
import {
  Dns as RpcIcon,
  Storage as IndexerIcon,
  Security as ProverIcon,
  Sync as SyncIcon,
  AddCircleOutlined as ExpenseIcon,
  GroupAdd as GroupIcon,
  ContentCopy as CopyIcon,
  GroupsOutlined as GroupsIcon,
  ShieldMoonOutlined as ShieldIcon,
  InsightsOutlined as InsightsIcon,
  AutoAwesomeOutlined as SparkleIcon,
  VerifiedOutlined as VerifiedIcon,
  EastRounded as ArrowIcon,
} from '@mui/icons-material';
import { DeployedSplitsContext } from './contexts/DeployedSplitsContext';
import { SplitsAPI, type SplitsDerivedState } from '../../api/src/index';
import { type Observable } from 'rxjs';
import { type SplitsDeployment, type DeployedSplitsDeployment } from './contexts/BrowserDeployedSplitsManager';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { calculateSettlement, type ParticipantBalance } from '@midnight-ntwrk/bboard-contract';
import * as Splits from '../../contract/src/managed/splits/contract/index.js';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';
import { TopNav } from './components/cs/TopNav';
import { SectionCard } from './components/cs/SectionCard';
import { Kicker } from './components/cs/Kicker';
import { WorkflowStepper } from './components/cs/WorkflowStepper';
import { TxTimeline } from './components/cs/TxTimeline';
import { InfraStatusRow } from './components/cs/InfraStatus';
import { MonoTag } from './components/cs/MonoTag';
import { Footer } from './components/cs/Footer';
import { useCountUp } from './hooks/useMotion';

interface SystemHealthResponse {
  result?: {
    isSyncing: boolean;
    peers: number;
    shouldHavePeers: boolean;
  };
}

interface ErrorDetails {
  name: string;
  message: string;
  code?: string;
  stack?: string;
}

const EMPTY_MEMBER = '0000000000000000000000000000000000000000000000000000000000000000';

const secretKeys = [
  new Uint8Array(32).map((_, i) => i), // User 0 secret key
  new Uint8Array(32).map((_, i) => i + 10), // User 1 secret key
  new Uint8Array(32).map((_, i) => i + 20), // User 2 secret key
  new Uint8Array(32).map((_, i) => i + 30), // User 3 secret key
];

// Pre-compute test users' public keys for easy E2E simulations / developer panel
const testPubKeys = secretKeys.map((key) => Splits.pureCircuits.publicKey(key));
/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
const testPubKeysHex = testPubKeys.map(toHex);

const hashAddressToSecretKey = async (address: string): Promise<Uint8Array> => {
  const msgUint8 = new TextEncoder().encode(address);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
  return new Uint8Array(hashBuffer);
};

const waitForDeployment = (deployment$: Observable<SplitsDeployment>): Promise<DeployedSplitsDeployment> => {
  return new Promise((resolve, reject) => {
    const sub = deployment$.subscribe({
      next: (val) => {
        if (val.status === 'deployed') {
          sub.unsubscribe();
          resolve(val);
        } else if (val.status === 'failed') {
          sub.unsubscribe();
          reject(val.error);
        }
      },
      error: (err: unknown) => {
        sub.unsubscribe();
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    });
  });
};

const App: React.FC = () => {
  const splitsApiProvider = useContext(DeployedSplitsContext);

  // Connection & Wallet states
  const [oneAmDetected, setOneAmDetected] = useState<boolean | null>(null);
  const [walletConnected, setWalletConnected] = useState<boolean>(false);
  const [walletAddress, setWalletAddress] = useState<string>('');
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  const [shieldedKeys, setShieldedKeys] = useState<{ coin: string; encryption: string } | null>(null);

  const [walletNetwork, setWalletNetwork] = useState<string>('');

  // Diagnostic states
  const [rpcStatus, setRpcStatus] = useState<'CHECKING' | 'CONNECTED' | 'FAILED'>('CHECKING');
  const [indexerStatus, setIndexerStatus] = useState<'CHECKING' | 'CONNECTED' | 'FAILED'>('CHECKING');
  const [proofServerStatus, setProofServerStatus] = useState<'CHECKING' | 'CONNECTED' | 'FAILED'>('CHECKING');

  const [splitsAPI, setSplitsAPI] = useState<SplitsAPI | null>(null);
  const [splitsAddressInput, setSplitsAddressInput] = useState<string>('');
  const [ledgerState, setLedgerState] = useState<SplitsDerivedState | null>(null);

  // Group creation & forms state
  const [groupNameInput, setGroupNameInput] = useState<string>('');

  // Expense forms state
  const [expenseAmount, setExpenseAmount] = useState<string>('1200');
  const [expensePayer, setExpensePayer] = useState<number>(0);

  // Active Simulated User index or Connected index
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  const [activeUserIdx, setActiveUserIdx] = useState<number>(0);
  const [currentUserIdx, setCurrentUserIdx] = useState<number | null>(null);

  // Global Transaction Feedback state
  // States: IDLE, PREPARING, PROVING, AWAITING_WALLET, SUBMITTED, CONFIRMING, CONFIRMED, REJECTED, FAILED
  const [txStage, setTxStage] = useState<
    | 'IDLE'
    | 'PREPARING'
    | 'PROVING'
    | 'AWAITING_WALLET'
    | 'SUBMITTED'
    | 'CONFIRMING'
    | 'CONFIRMED'
    | 'REJECTED'
    | 'FAILED'
  >('IDLE');
  const [txError, setTxError] = useState<string>('');
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  const [txErrorDetails, setTxErrorDetails] = useState<ErrorDetails | null>(null);
  const [latestContractAddress, setLatestContractAddress] = useState<string>('');

  // Invite Link Check
  const [inviteAddress, setInviteAddress] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Presentation-only: transient toast mirroring the final transaction outcome
  const [toast, setToast] = useState<{ open: boolean; severity: 'success' | 'error'; msg: string }>({
    open: false,
    severity: 'success',
    msg: '',
  });

  // Detect 1AM wallet presence
  const checkOneAmPresence = (): boolean => {
    const hasOneAm = typeof window !== 'undefined' && !!window.midnight?.['1am'];
    setOneAmDetected(hasOneAm);
    return hasOneAm;
  };

  // Health check endpoints
  const checkRpc = async (): Promise<void> => {
    setRpcStatus('CHECKING');
    try {
      const res = await fetch('https://rpc.preprod.midnight.network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'system_health',
          params: [],
          id: 1,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as SystemHealthResponse;
        if (data && data.result) {
          setRpcStatus('CONNECTED');
          return;
        }
      }
      setRpcStatus('FAILED');
    } catch {
      setRpcStatus('FAILED');
    }
  };

  const checkIndexer = async (): Promise<void> => {
    setIndexerStatus('CHECKING');
    try {
      const res = await fetch('https://indexer.preprod.midnight.network/api/v4/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: '{ __schema { queryType { name } } }',
        }),
      });
      if (res.status === 200 || res.status === 400) {
        setIndexerStatus('CONNECTED');
      } else {
        setIndexerStatus('FAILED');
      }
    } catch {
      setIndexerStatus('FAILED');
    }
  };

  const checkProofServer = async (): Promise<void> => {
    setProofServerStatus('CHECKING');
    try {
      const res = await fetch('http://localhost:6300', {
        method: 'GET',
        mode: 'no-cors',
      });
      if (res && (res.status === 200 || res.status === 0)) {
        setProofServerStatus('CONNECTED');
      } else {
        setProofServerStatus('FAILED');
      }
    } catch {
      setProofServerStatus('FAILED');
    }
  };

  // Connect Wallet
  const connectOneAm = async (): Promise<void> => {
    setTxError('');
    setTxErrorDetails(null);
    try {
      const oneAm = window.midnight!['1am'];
      const connectedApi = await oneAm.connect('preprod');
      const config = await connectedApi.getConfiguration();
      if (config.networkId) {
        setNetworkId(config.networkId);
      }
      setWalletNetwork(config.networkId === 'preprod' ? 'preprod' : config.networkId || 'unknown');

      const unshieldedAddrObj = await connectedApi.getUnshieldedAddress();
      setWalletAddress(unshieldedAddrObj.unshieldedAddress);

      const shieldedAddrs = await connectedApi.getShieldedAddresses();
      setShieldedKeys({
        coin: shieldedAddrs.shieldedCoinPublicKey,
        encryption: shieldedAddrs.shieldedEncryptionPublicKey,
      });

      setWalletConnected(true);
    } catch (e: unknown) {
      console.error('Wallet connection failed:', e);
      setWalletConnected(false);
      // Presentation only: surface the *actual* reason instead of a dead-end string.
      const reason = e instanceof Error && e.message ? e.message : String(e);
      const noExtension = typeof window === 'undefined' || !window.midnight?.['1am'];
      setTxError(
        noExtension
          ? 'No 1AM Wallet found in this browser. Install the 1AM Wallet extension, unlock it and switch it to the Preprod network, then reload this page.'
          : `Wallet handshake failed: ${reason}. Check that the 1AM Wallet is unlocked, set to Preprod, and that the local proof server (localhost:6300) is running.`,
      );
    }
  };

  // Create Group (Deploys contract with only Creator in slot 0)
  const handleCreateGroup = async (): Promise<void> => {
    if (!walletConnected || !walletAddress) {
      setTxError('Please connect your wallet first.');
      return;
    }
    setTxStage('PREPARING');
    setTxError('');
    setTxErrorDetails(null);

    try {
      setNetworkId('preprod');
      setTxStage('PROVING');

      // Derive creator's key from the connected wallet address
      const secretKey = await hashAddressToSecretKey(walletAddress);
      const creatorPk = Splits.pureCircuits.publicKey(secretKey);

      // Deploy contract passing only the creator's key (others are empty padded)
      const deployment$ = splitsApiProvider!.resolve(undefined, [creatorPk]);
      setTxStage('AWAITING_WALLET');
      const deploymentResult = await waitForDeployment(deployment$);

      setTxStage('SUBMITTED');
      await deploymentResult.api.changeActiveUser(0, secretKey);
      setActiveUserIdx(0);
      setCurrentUserIdx(0);
      setSplitsAPI(deploymentResult.api);
      setLatestContractAddress(deploymentResult.api.deployedContractAddress);
      setTxStage('CONFIRMED');
    } catch (e: unknown) {
      console.error('Group creation failure:', e);
      setTxStage('FAILED');
      setTxError(e instanceof Error ? e.message : 'Contract deployment failed.');
    }
  };

  // Connects to already deployed address
  const handleConnectToGroup = async (addressToConnect?: string): Promise<void> => {
    const targetAddr = addressToConnect || splitsAddressInput.trim();
    if (!targetAddr) {
      setTxError('Please enter a contract address to connect');
      return;
    }
    setTxStage('PREPARING');
    setTxError('');
    setTxErrorDetails(null);

    try {
      setNetworkId('preprod');
      const deployment$ = splitsApiProvider!.resolve(targetAddr);
      const deploymentResult = await waitForDeployment(deployment$);

      setSplitsAPI(deploymentResult.api);
      setLatestContractAddress(deploymentResult.api.deployedContractAddress);
      setTxStage('CONFIRMED');
    } catch (e: unknown) {
      console.error('Connect group failure:', e);
      setTxStage('FAILED');
      setTxError(e instanceof Error ? e.message : 'Connecting to contract failed.');
    }
  };

  // Join Group Flow
  const handleJoinSlot = async (slotIdx: number): Promise<void> => {
    if (!walletConnected || !walletAddress) {
      setTxError('Please connect your wallet first.');
      return;
    }
    if (!splitsAPI) {
      setTxError('No active splits contract session.');
      return;
    }
    setTxStage('PREPARING');
    setTxError('');
    setTxErrorDetails(null);

    try {
      setNetworkId('preprod');
      setTxStage('PROVING');
      const secretKey = await hashAddressToSecretKey(walletAddress);

      // Update local private key provider to authorize joining
      await splitsAPI.changeActiveUser(slotIdx, secretKey);

      setTxStage('AWAITING_WALLET');
      await splitsAPI.joinGroup(slotIdx);

      setActiveUserIdx(slotIdx);
      setCurrentUserIdx(slotIdx);
      setTxStage('CONFIRMED');
    } catch (e: unknown) {
      console.error('Join slot failure:', e);
      setTxStage('FAILED');
      setTxError(e instanceof Error ? e.message : 'Failed to join group slot.');
    }
  };

  // Post Expense
  const handlePostExpense = async (): Promise<void> => {
    const amountVal = BigInt(expenseAmount);
    if (amountVal <= 0n) {
      setTxError('Expense amount must be greater than 0');
      return;
    }
    setTxStage('PREPARING');
    setTxError('');
    setTxErrorDetails(null);

    if (!splitsAPI || !ledgerState) {
      setTxError('No active splits session');
      return;
    }

    try {
      setNetworkId('preprod');
      setTxStage('PROVING');

      // Calculate active members count
      const activeMembers = ledgerState.members.filter((m) => m !== EMPTY_MEMBER);
      const activeCount = BigInt(activeMembers.length);

      // Equal split among active members only
      const shareVal = amountVal / activeCount;
      const remainder = amountVal % activeCount;

      const shares = [0n, 0n, 0n, 0n];
      let assignedIndex = 0;
      ledgerState.members.forEach((m, idx) => {
        if (m !== EMPTY_MEMBER) {
          shares[idx] = shareVal + (assignedIndex === 0 ? remainder : 0n);
          assignedIndex++;
        }
      });

      setTxStage('AWAITING_WALLET');
      await splitsAPI.postExpense(BigInt(expensePayer), amountVal, shares);
      setTxStage('CONFIRMED');
    } catch (e: unknown) {
      console.error('Post expense failure:', e);
      setTxStage('FAILED');
      setTxError(e instanceof Error ? e.message : 'Posting expense transaction failed.');
    }
  };

  // Sync Private Balance
  const handleSyncBalance = async (): Promise<void> => {
    setTxStage('PREPARING');
    setTxError('');
    setTxErrorDetails(null);

    if (!splitsAPI || !ledgerState || currentUserIdx === null) {
      setTxError('No active splits session or not a joined member');
      return;
    }

    try {
      setNetworkId('preprod');
      setTxStage('PROVING');
      setTxStage('AWAITING_WALLET');
      await splitsAPI.syncBalance(currentUserIdx, ledgerState);
      setTxStage('CONFIRMED');
    } catch (e: unknown) {
      console.error('Sync balance failure:', e);
      setTxStage('FAILED');
      setTxError(e instanceof Error ? e.message : 'ZK private balance syncing failed.');
    }
  };

  // Post Settlement Payment (Debtor)
  const handlePostPayment = async (debtorIdx: number, creditorIdx: number, amount: bigint): Promise<void> => {
    setTxStage('PREPARING');
    setTxError('');
    setTxErrorDetails(null);

    if (!splitsAPI) {
      setTxError('No active splits session');
      return;
    }

    try {
      setNetworkId('preprod');
      setTxStage('PROVING');
      setTxStage('AWAITING_WALLET');
      await splitsAPI.postPayment(debtorIdx, creditorIdx, amount);
      setTxStage('CONFIRMED');
    } catch (e: unknown) {
      console.error('Post payment failure:', e);
      setTxStage('FAILED');
      setTxError(e instanceof Error ? e.message : 'Post settlement payment failed.');
    }
  };

  // Claim Settlement Payment (Creditor)
  const handleClaimPayment = async (): Promise<void> => {
    setTxStage('PREPARING');
    setTxError('');
    setTxErrorDetails(null);

    if (!splitsAPI || !ledgerState) {
      setTxError('No active splits session');
      return;
    }

    try {
      setNetworkId('preprod');
      setTxStage('PROVING');
      setTxStage('AWAITING_WALLET');
      await splitsAPI.claimPayment(ledgerState);
      setTxStage('CONFIRMED');
    } catch (e: unknown) {
      console.error('Claim payment failure:', e);
      setTxStage('FAILED');
      setTxError(e instanceof Error ? e.message : 'Claiming settlement payment failed.');
    }
  };

  // Check query params for join link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinAddr = params.get('join');
    if (joinAddr) {
      setInviteAddress(joinAddr);
      setSplitsAddressInput(joinAddr);
    }
  }, []);

  // Automatically connect to the group if an invite address is present and wallet is connected
  useEffect(() => {
    if (walletConnected && inviteAddress && !splitsAPI) {
      void handleConnectToGroup(inviteAddress);
    }
  }, [walletConnected, inviteAddress, splitsAPI]);

  // Run initial diagnostics & presence polling on load
  useEffect(() => {
    let checks = 0;
    const intervalId = setInterval(() => {
      const detected = checkOneAmPresence();
      checks++;
      if (detected || checks >= 30) {
        clearInterval(intervalId);
      }
    }, 100);

    void checkRpc();
    void checkIndexer();
    void checkProofServer();

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  // Dismiss the pre-hydration splash once React has painted.
  useEffect(() => {
    const id = window.setTimeout(() => document.body.classList.add('app-ready'), 60);
    return () => window.clearTimeout(id);
  }, []);

  // Presentation-only: surface a toast whenever a transaction settles.
  useEffect(() => {
    if (txStage === 'CONFIRMED') {
      setToast({ open: true, severity: 'success', msg: 'Transaction confirmed on Midnight Preprod.' });
    } else if (txStage === 'FAILED' || txStage === 'REJECTED') {
      setToast({ open: true, severity: 'error', msg: txError || 'The transaction did not go through.' });
    }
  }, [txStage, txError]);

  // Sync observable ledger updates when contract joins/deploys
  useEffect(() => {
    if (!splitsAPI) return;

    const sub = splitsAPI.state$.subscribe({
      next: (state: SplitsDerivedState) => {
        setLedgerState(state);
      },
      error: (err: unknown) => {
        console.error('Ledger state stream error:', err);
      },
    });

    return () => sub.unsubscribe();
  }, [splitsAPI]);

  // Handle auto-detect role on ledger or wallet state changes
  useEffect(() => {
    const resolveConnectedUser = async () => {
      if (!walletConnected || !walletAddress || !ledgerState || walletAddress.startsWith('mock_wallet_address_')) {
        return;
      }
      try {
        const secretKey = await hashAddressToSecretKey(walletAddress);
        const pk = Splits.pureCircuits.publicKey(secretKey);
        const pkHex = toHex(pk);

        const idx = ledgerState.members.findIndex((m) => m === pkHex);
        if (idx !== -1) {
          setCurrentUserIdx(idx);
          setActiveUserIdx(idx);
          if (splitsAPI) {
            await splitsAPI.changeActiveUser(idx, secretKey);
          }
        } else {
          setCurrentUserIdx(null); // Guest
        }
      } catch (err) {
        console.error('Error resolving user from wallet address:', err);
      }
    };
    void resolveConnectedUser();
  }, [walletConnected, walletAddress, ledgerState, splitsAPI]);

  // Derived Local Calculations - Settlement optimization using greedy min-flow
  let optimizedSettlements: Array<{ debtor: number; creditor: number; amount: bigint }> = [];
  let isSettlementValid = false;
  let validationError = '';

  if (ledgerState) {
    // Populate Participant balances
    const pBalances: ParticipantBalance[] = [];
    for (let i = 0; i < 4; i++) {
      const member = ledgerState.members[i];
      if (member !== EMPTY_MEMBER) {
        pBalances.push({
          participantId: `User ${i}`,
          balance: ledgerState.balances[i] || 0n,
        });
      }
    }

    try {
      const result = calculateSettlement(pBalances);
      optimizedSettlements = result.transactions.map((tx) => {
        const dIdx = Number(tx.debtorId.split(' ')[1]);
        const cIdx = Number(tx.creditorId.split(' ')[1]);
        return { debtor: dIdx, creditor: cIdx, amount: tx.amount };
      });
      isSettlementValid = true;
    } catch (e: unknown) {
      isSettlementValid = false;
      const msg = e instanceof Error ? e.message : String(e);
      validationError = msg || 'Settlement verification failed.';
    }
  }

  const copyInviteLink = () => {
    if (!latestContractAddress) return;
    const inviteLink = `${window.location.origin}/?join=${latestContractAddress}`;
    void navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // ----- Presentation-only derived values -------------------------------------

  const infraHealthy = rpcStatus === 'CONNECTED' && indexerStatus === 'CONNECTED' && proofServerStatus === 'CONNECTED';

  const shortWallet = walletAddress.startsWith('mock_wallet_address_')
    ? walletAddress
    : walletAddress
      ? `${walletAddress.slice(0, 6)}····${walletAddress.slice(-4)}`
      : '';

  const roleLabel = walletConnected
    ? currentUserIdx !== null
      ? `Member · slot ${currentUserIdx}`
      : 'Guest viewer'
    : undefined;

  const memberCount = ledgerState ? ledgerState.members.filter((m) => m !== EMPTY_MEMBER).length : 0;
  const allSynced = ledgerState ? ledgerState.synced_mask.every(Boolean) : false;
  const hasPendingPayment = ledgerState?.pending_payment_status === 1n;

  const activeStep = (() => {
    if (!walletConnected) return 0;
    if (!ledgerState) return 1;
    if (currentUserIdx === null) return 1;
    if (hasPendingPayment || optimizedSettlements.length > 0) return 4;
    if (!allSynced) return 3;
    return 2;
  })();

  const netBalance = ledgerState && currentUserIdx !== null ? ledgerState.balances[currentUserIdx] || 0n : 0n;
  const animatedBalance = useCountUp(Number(netBalance));
  const connectingToGroup = walletConnected && !!splitsAPI && !ledgerState;

  const SPEC = [
    { k: 'commitments', v: 'Balances stored on-chain only as hash commitments' },
    { k: 'proofs', v: 'Every state transition proven locally with zero-knowledge' },
    { k: 'settlement', v: 'Greedy min-cash-flow reduces N debts to the fewest transfers' },
  ];

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 }}>
      <TopNav
        network={walletNetwork || 'preprod'}
        walletConnected={walletConnected}
        walletLabel={shortWallet}
        roleLabel={roleLabel}
        infraHealthy={infraHealthy}
      />

      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 }, flexGrow: 1 }}>
        {/* ============================ HERO ============================ */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: walletConnected ? '1fr' : '1.05fr 0.95fr' },
            gap: { xs: 4, md: 5 },
            alignItems: 'center',
            mb: { xs: 4, md: 6 },
          }}
        >
          <Box sx={{ animation: 'cs-rise 500ms cubic-bezier(.2,.7,.2,1) both' }}>
            <Kicker index="00" label="Zero-knowledge group settlements" />
            <Typography
              variant="h2"
              sx={{
                fontSize: { xs: '2.1rem', sm: '2.7rem', md: walletConnected ? '2.3rem' : '3.1rem' },
                mb: 2,
              }}
            >
              Split shared costs.
              <br />
              <Box
                component="span"
                sx={{
                  background: 'linear-gradient(90deg, #a78bfa 0%, #2dd4bf 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Keep every balance private.
              </Box>
            </Typography>
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ maxWidth: 560, fontSize: { xs: '0.95rem', md: '1.02rem' }, lineHeight: 1.65 }}
            >
              A Splitwise-style expense tracker built on Midnight. Running balances, blinding salts and witness keys
              never leave your device — only ZK commitments and settlement metadata reach the public ledger.
            </Typography>

            {!walletConnected && (
              <Box sx={{ mt: 3.5, display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => void connectOneAm()}
                  disabled={oneAmDetected === false}
                  endIcon={<ArrowIcon />}
                >
                  Connect 1AM Wallet
                </Button>
                <Typography variant="caption" color="text.disabled">
                  {oneAmDetected === false
                    ? '1AM extension not detected — install it, then reload'
                    : oneAmDetected === null
                      ? 'Looking for the 1AM extension…'
                      : 'Preprod testnet · no real funds'}
                </Typography>
              </Box>
            )}

            {txError && !walletConnected && (
              <Alert severity="error" sx={{ mt: 2.5, maxWidth: 560, alignItems: 'flex-start' }}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.75 }}>
                  {txError}
                </Typography>
                <Box component="ol" sx={{ m: 0, pl: 2.25, '& li': { mb: 0.35, fontSize: '0.8rem' } }}>
                  <li>Install the 1AM Wallet browser extension and create / import a wallet.</li>
                  <li>Open it, unlock it, and switch the network to Preprod.</li>
                  <li>
                    Start the local proof server:{' '}
                    <Box component="code" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem' }}>
                      docker compose -f bboard-cli/proof-server-local.yml up -d
                    </Box>
                  </li>
                  <li>Reload this page and click Connect again.</li>
                </Box>
              </Alert>
            )}

            {/* spec list — replaces the usual chip row */}
            <Stack spacing={1.25} sx={{ mt: 4, maxWidth: 560 }}>
              {SPEC.map((s) => (
                <Box key={s.k} sx={{ display: 'flex', gap: 1.5, alignItems: 'baseline' }}>
                  <Typography
                    component="span"
                    sx={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      color: 'primary.light',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      minWidth: 92,
                      flexShrink: 0,
                    }}
                  >
                    {s.k}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                    {s.v}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Box>

          {!walletConnected && (
            <Box sx={{ animation: 'cs-rise 620ms cubic-bezier(.2,.7,.2,1) both' }}>
              <SectionCard
                title="Midnight infrastructure"
                subtitle="Live reachability of everything this dApp depends on"
                kicker="Diagnostics"
                index="01"
                icon={<InsightsIcon />}
                accent="#2dd4bf"
                glow
              >
                <Stack spacing={1.25}>
                  <InfraStatusRow
                    icon={<RpcIcon sx={{ fontSize: '1.05rem' }} />}
                    label="Preprod RPC node"
                    detail="rpc.preprod.midnight.network"
                    state={rpcStatus}
                  />
                  <InfraStatusRow
                    icon={<IndexerIcon sx={{ fontSize: '1.05rem' }} />}
                    label="GraphQL indexer"
                    detail="indexer.preprod.midnight.network/api/v4"
                    state={indexerStatus}
                  />
                  <InfraStatusRow
                    icon={<ProverIcon sx={{ fontSize: '1.05rem' }} />}
                    label="Local proof server"
                    detail="localhost:6300"
                    state={proofServerStatus}
                  />
                </Stack>
                {proofServerStatus === 'FAILED' && (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    Start it with{' '}
                    <Box component="code" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.78em' }}>
                      docker compose -f bboard-cli/proof-server-local.yml up -d
                    </Box>
                  </Alert>
                )}
              </SectionCard>
            </Box>
          )}
        </Box>

        {/* ======================= WORKFLOW RAIL ======================= */}
        <Box sx={{ mb: { xs: 4, md: 5 } }}>
          <WorkflowStepper activeStep={activeStep} />
        </Box>

        {/* Persistent prerequisite blocker — the proof server is required for every transaction */}
        {proofServerStatus === 'FAILED' && (
          <Alert severity="warning" sx={{ mb: 4, alignItems: 'flex-start' }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              Local proof server is offline — wallet connect and every transaction will fail until it is running.
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Start it from the repo root, then reload:{' '}
              <Box component="code" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.78rem' }}>
                docker compose -f bboard-cli/proof-server-local.yml up -d
              </Box>
            </Typography>
          </Alert>
        )}

        {/* Invite banner */}
        {inviteAddress && !splitsAPI && (
          <Alert severity="info" sx={{ mb: 4 }} icon={<GroupIcon />}>
            You have been invited to join group <strong>{inviteAddress.slice(0, 16)}…</strong>. Connect your wallet and
            take an empty slot below to participate.
          </Alert>
        )}

        {/* ========================= DASHBOARD ========================= */}
        {walletConnected && (
          <Grid container spacing={3}>
            {/* Active group ledger */}
            <Grid size={{ xs: 12 }}>
              <SectionCard
                title="Active group ledger"
                kicker="Session"
                index="02"
                subtitle={
                  latestContractAddress
                    ? 'Share the invite link to add up to three more members'
                    : 'Create a new group or connect to an existing contract'
                }
                icon={<GroupsIcon />}
                action={
                  latestContractAddress ? (
                    <Button
                      size="small"
                      variant="outlined"
                      color="secondary"
                      startIcon={<CopyIcon />}
                      onClick={copyInviteLink}
                    >
                      {copiedLink ? 'Link copied' : 'Copy invite link'}
                    </Button>
                  ) : undefined
                }
              >
                {latestContractAddress ? (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
                    <MonoTag value={latestContractAddress} truncate={14} color="#a78bfa" />
                    <Chip size="small" label={`${memberCount} / 4 members`} />
                    {ledgerState && (
                      <Chip
                        size="small"
                        variant="outlined"
                        label={allSynced ? 'All balances synced' : 'Sync pending'}
                        sx={{ color: allSynced ? 'success.light' : 'warning.light', borderColor: 'currentColor' }}
                      />
                    )}
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', flex: '1 1 320px' }}>
                      <TextField
                        size="small"
                        label="Existing contract address"
                        value={splitsAddressInput}
                        onChange={(e) => setSplitsAddressInput(e.target.value)}
                        sx={{ minWidth: 240, flexGrow: 1 }}
                      />
                      <Button variant="outlined" onClick={() => void handleConnectToGroup()}>
                        Connect
                      </Button>
                    </Box>
                    <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' } }} />
                    <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', flex: '1 1 320px' }}>
                      <TextField
                        size="small"
                        label="New group name"
                        value={groupNameInput}
                        onChange={(e) => setGroupNameInput(e.target.value)}
                        sx={{ minWidth: 170, flexGrow: 1 }}
                      />
                      <Button variant="contained" color="secondary" onClick={() => void handleCreateGroup()}>
                        Create group
                      </Button>
                    </Box>
                  </Box>
                )}
              </SectionCard>
            </Grid>

            {/* Skeleton while the ledger stream warms up */}
            {connectingToGroup && (
              <>
                <Grid size={{ xs: 12, md: 7 }}>
                  <Paper sx={{ p: 3.25, borderRadius: 3.5 }}>
                    <Skeleton width={120} height={14} />
                    <Skeleton width="55%" height={26} sx={{ mt: 1 }} />
                    <Stack spacing={1.25} sx={{ mt: 2.5 }}>
                      {[0, 1, 2, 3].map((i) => (
                        <Skeleton key={i} variant="rounded" height={52} />
                      ))}
                    </Stack>
                  </Paper>
                </Grid>
                <Grid size={{ xs: 12, md: 5 }}>
                  <Paper sx={{ p: 3.25, borderRadius: 3.5, height: '100%' }}>
                    <Skeleton width={120} height={14} />
                    <Skeleton variant="rounded" height={92} sx={{ mt: 2 }} />
                    <Skeleton variant="rounded" height={40} sx={{ mt: 2 }} />
                    <Skeleton variant="rounded" height={40} sx={{ mt: 1.5 }} />
                  </Paper>
                </Grid>
              </>
            )}

            {ledgerState && (
              <>
                {/* PUBLIC LEDGER STATE */}
                <Grid size={{ xs: 12, md: 7 }}>
                  <SectionCard
                    title="Public group data"
                    kicker="On-chain"
                    index="03"
                    subtitle="Everything visible to anyone reading the ledger"
                    icon={<GroupsIcon />}
                    sx={{ animationDelay: '60ms' }}
                  >
                    <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                      Membership slots
                    </Typography>
                    <Stack spacing={1}>
                      {ledgerState.members.map((member: string, i: number) => {
                        const isEmpty = member === EMPTY_MEMBER;
                        const isCurrentUserMember = currentUserIdx !== null;
                        const isMe = currentUserIdx === i;

                        return (
                          <Box
                            key={i}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1.5,
                              p: 1.25,
                              borderRadius: 2.5,
                              border: '1px solid',
                              borderColor: isMe ? 'primary.main' : 'divider',
                              bgcolor: isMe ? 'rgba(139,92,246,0.08)' : 'rgba(7,6,11,0.35)',
                              transition: 'border-color 160ms ease',
                            }}
                          >
                            <Box
                              sx={{
                                width: 30,
                                height: 30,
                                borderRadius: '50%',
                                display: 'grid',
                                placeItems: 'center',
                                flexShrink: 0,
                                fontWeight: 700,
                                fontSize: '0.78rem',
                                fontFamily: "'JetBrains Mono', monospace",
                                color: isEmpty ? 'text.disabled' : 'primary.contrastText',
                                bgcolor: isEmpty ? 'transparent' : 'primary.main',
                                border: isEmpty ? '1px dashed' : '1px solid transparent',
                                borderColor: isEmpty ? 'divider' : 'transparent',
                              }}
                            >
                              {i}
                            </Box>
                            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
                                User {i}
                                {i === 0 ? ' · Creator' : ''}
                                {isMe ? ' · You' : ''}
                              </Typography>
                              {isEmpty ? (
                                <Typography variant="caption" color="text.disabled">
                                  Vacant slot
                                </Typography>
                              ) : (
                                <MonoTag value={member} truncate={9} />
                              )}
                            </Box>
                            {isEmpty && !isCurrentUserMember ? (
                              <Button size="small" variant="contained" onClick={() => void handleJoinSlot(i)}>
                                Join slot {i}
                              </Button>
                            ) : !isEmpty ? (
                              <Chip
                                label={ledgerState.synced_mask[i] ? 'Synced' : 'Pending'}
                                size="small"
                                variant="outlined"
                                sx={{
                                  color: ledgerState.synced_mask[i] ? 'success.light' : 'warning.light',
                                  borderColor: 'currentColor',
                                }}
                              />
                            ) : (
                              <Typography variant="caption" color="text.disabled">
                                Vacant
                              </Typography>
                            )}
                          </Box>
                        );
                      })}
                    </Stack>

                    <Box
                      sx={{
                        mt: 2.5,
                        p: 2,
                        bgcolor: 'rgba(139,92,246,0.08)',
                        borderRadius: 2.5,
                        border: '1px solid rgba(167,139,250,0.2)',
                      }}
                    >
                      <Typography variant="overline" sx={{ display: 'block', mb: 1, color: 'primary.light' }}>
                        Pending expense
                      </Typography>
                      <Grid container spacing={1.5}>
                        <Grid size={{ xs: 6, sm: 4 }}>
                          <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>
                            Payer
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}
                          >
                            User {ledgerState.pending_expense_payer_idx}
                          </Typography>
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4 }}>
                          <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>
                            Amount
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}
                          >
                            {ledgerState.pending_expense_amount.toString()} tNight
                          </Typography>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4 }}>
                          <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>
                            Split
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}
                          >
                            [{ledgerState.pending_expense_shares.map((s: bigint) => s.toString()).join(', ')}]
                          </Typography>
                        </Grid>
                      </Grid>
                    </Box>

                    {ledgerState.pending_payment_status === 1n && (
                      <Box
                        sx={{
                          mt: 2,
                          p: 2,
                          bgcolor: 'rgba(45,212,191,0.08)',
                          borderRadius: 2.5,
                          border: '1px solid rgba(45,212,191,0.25)',
                        }}
                      >
                        <Typography variant="overline" sx={{ display: 'block', mb: 1, color: 'secondary.light' }}>
                          Pending settlement payment
                        </Typography>
                        <Typography variant="body2" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>
                          User {ledgerState.pending_payment_from.toString()}
                          <ArrowIcon sx={{ fontSize: '0.9rem', verticalAlign: 'middle', mx: 0.75 }} />
                          User {ledgerState.pending_payment_to.toString()} ·{' '}
                          <strong>{ledgerState.pending_payment_amount.toString()} tNight</strong>
                        </Typography>
                      </Box>
                    )}
                  </SectionCard>
                </Grid>

                {/* SHIELDED PRIVATE STATE */}
                <Grid size={{ xs: 12, md: 5 }}>
                  <SectionCard
                    title="Your private data"
                    kicker="Shielded"
                    index="04"
                    subtitle="Computed locally — never transmitted"
                    icon={<ShieldIcon />}
                    accent="#2dd4bf"
                    glow
                    sx={{ animationDelay: '120ms' }}
                  >
                    {currentUserIdx !== null ? (
                      <>
                        <Box
                          sx={{
                            p: 2.25,
                            borderRadius: 3,
                            mb: 2,
                            position: 'relative',
                            overflow: 'hidden',
                            background: 'linear-gradient(155deg, rgba(45,212,191,0.16), rgba(45,212,191,0.02))',
                            border: '1px solid rgba(45,212,191,0.28)',
                          }}
                        >
                          <Typography
                            variant="overline"
                            sx={{ color: 'text.secondary', display: 'block', fontSize: '0.62rem' }}
                          >
                            Private net balance · User {currentUserIdx}
                          </Typography>
                          <Typography
                            sx={{
                              fontFamily: "'Space Grotesk', sans-serif",
                              fontWeight: 700,
                              fontSize: '2rem',
                              letterSpacing: '-0.02em',
                              fontVariantNumeric: 'tabular-nums',
                              mt: 0.25,
                              color: netBalance >= 0n ? 'secondary.light' : 'error.light',
                            }}
                          >
                            {netBalance >= 0n ? '+' : '−'}
                            {Math.abs(Math.round(animatedBalance)).toLocaleString()}
                            <Box component="span" sx={{ fontSize: '0.9rem', color: 'text.secondary', ml: 0.75 }}>
                              tNight
                            </Box>
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {netBalance > 0n
                              ? 'the group owes you'
                              : netBalance < 0n
                                ? 'you owe the group'
                                : 'settled up'}
                          </Typography>
                        </Box>

                        <Stack spacing={1.5} sx={{ mb: 2.5 }}>
                          <Box>
                            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 0.5 }}>
                              Private blinding salt
                            </Typography>
                            <MonoTag value={String(ledgerState.salts[currentUserIdx])} truncate={12} />
                          </Box>
                          <Box>
                            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 0.5 }}>
                              On-chain balance commitment
                            </Typography>
                            <MonoTag value={String(ledgerState.balance_commitments[currentUserIdx])} truncate={12} />
                          </Box>
                        </Stack>

                        <Box sx={{ flexGrow: 1 }} />

                        {!ledgerState.synced_mask[currentUserIdx] ? (
                          <Button
                            variant="contained"
                            color="secondary"
                            startIcon={<SyncIcon />}
                            fullWidth
                            onClick={() => void handleSyncBalance()}
                          >
                            Sync private balance (ZK proof)
                          </Button>
                        ) : (
                          <Alert severity="success" icon={<VerifiedIcon />}>
                            Your shielded balance matches the latest ledger expense.
                          </Alert>
                        )}
                      </>
                    ) : (
                      <Box
                        sx={{
                          flexGrow: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          textAlign: 'center',
                          py: 5,
                          gap: 1,
                        }}
                      >
                        <Box
                          sx={{
                            width: 52,
                            height: 52,
                            borderRadius: '50%',
                            display: 'grid',
                            placeItems: 'center',
                            bgcolor: 'rgba(255,255,255,0.03)',
                            border: '1px solid',
                            borderColor: 'divider',
                            mb: 0.5,
                          }}
                        >
                          <ShieldIcon sx={{ fontSize: 24, color: 'text.disabled' }} />
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          You are viewing this group as a guest.
                        </Typography>
                        <Typography variant="caption" color="text.disabled" sx={{ maxWidth: 240 }}>
                          Take an empty slot in the membership panel to unlock your private shielded state.
                        </Typography>
                      </Box>
                    )}
                  </SectionCard>
                </Grid>

                {/* SETTLEMENT ENGINE */}
                <Grid size={{ xs: 12, md: 6 }}>
                  <SectionCard
                    title="Optimised settlement"
                    kicker="Engine"
                    index="05"
                    subtitle="Greedy minimum cash-flow — fewest transfers to zero out"
                    icon={<InsightsIcon />}
                    sx={{ animationDelay: '180ms' }}
                  >
                    {isSettlementValid ? (
                      optimizedSettlements.length === 0 ? (
                        <Alert severity="success" icon={<VerifiedIcon />}>
                          Everyone is settled — all net balances are zero.
                        </Alert>
                      ) : (
                        <Stack spacing={1}>
                          {optimizedSettlements.map((settle, i) => {
                            const isActiveDebtor = currentUserIdx !== null && settle.debtor === currentUserIdx;
                            const isActiveCreditor = currentUserIdx !== null && settle.creditor === currentUserIdx;
                            const pending = ledgerState.pending_payment_status === 1n;

                            return (
                              <Box
                                key={i}
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1.5,
                                  p: 1.5,
                                  borderRadius: 2.5,
                                  border: '1px solid',
                                  borderColor: 'divider',
                                  bgcolor: 'rgba(7,6,11,0.35)',
                                }}
                              >
                                <Box sx={{ flexGrow: 1 }}>
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      fontWeight: 600,
                                      fontFamily: "'JetBrains Mono', monospace",
                                      fontSize: '0.82rem',
                                    }}
                                  >
                                    User {settle.debtor}
                                    <ArrowIcon
                                      sx={{
                                        fontSize: '0.9rem',
                                        verticalAlign: 'middle',
                                        mx: 0.75,
                                        color: 'primary.light',
                                      }}
                                    />
                                    User {settle.creditor}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {settle.amount.toString()} tNight
                                  </Typography>
                                </Box>
                                {isActiveDebtor && !pending ? (
                                  <Button
                                    size="small"
                                    variant="contained"
                                    color="warning"
                                    onClick={() =>
                                      void handlePostPayment(settle.debtor, settle.creditor, settle.amount)
                                    }
                                  >
                                    Pay
                                  </Button>
                                ) : isActiveCreditor && pending ? (
                                  <Button
                                    size="small"
                                    variant="contained"
                                    color="secondary"
                                    onClick={() => void handleClaimPayment()}
                                  >
                                    Claim
                                  </Button>
                                ) : null}
                              </Box>
                            );
                          })}
                        </Stack>
                      )
                    ) : (
                      <Alert severity="error">{validationError}</Alert>
                    )}
                  </SectionCard>
                </Grid>

                {/* POST EXPENSE ACTION */}
                <Grid size={{ xs: 12, md: 6 }}>
                  <SectionCard
                    title="Post a group expense"
                    kicker="Action"
                    index="06"
                    subtitle="Split equally across all active members"
                    icon={<ExpenseIcon />}
                    sx={{ animationDelay: '240ms' }}
                  >
                    <Stack spacing={2} sx={{ flexGrow: 1 }}>
                      <FormControl size="small" disabled={currentUserIdx === null} fullWidth>
                        <InputLabel>Paid by</InputLabel>
                        <Select
                          value={expensePayer}
                          label="Paid by"
                          onChange={(e) => setExpensePayer(Number(e.target.value))}
                        >
                          {ledgerState.members.map((member, i) => {
                            if (member !== EMPTY_MEMBER) {
                              return (
                                <MenuItem key={i} value={i}>
                                  {currentUserIdx === i ? `You (User ${i})` : `User ${i} (${member.slice(0, 8)}…)`}
                                </MenuItem>
                              );
                            }
                            return null;
                          })}
                        </Select>
                      </FormControl>

                      <TextField
                        size="small"
                        label="Amount (tNight)"
                        value={expenseAmount}
                        onChange={(e) => setExpenseAmount(e.target.value)}
                        disabled={currentUserIdx === null}
                        fullWidth
                      />

                      {currentUserIdx !== null && memberCount > 0 && (
                        <Typography variant="caption" color="text.disabled">
                          Each of the {memberCount} member{memberCount === 1 ? '' : 's'} is assigned ≈{' '}
                          {(() => {
                            try {
                              const a = BigInt(expenseAmount || '0');
                              return a > 0n ? (a / BigInt(memberCount)).toString() : '0';
                            } catch {
                              return '—';
                            }
                          })()}{' '}
                          tNight.
                        </Typography>
                      )}

                      <Box sx={{ flexGrow: 1 }} />

                      <Button
                        variant="contained"
                        startIcon={<ExpenseIcon />}
                        onClick={() => void handlePostExpense()}
                        disabled={currentUserIdx === null || !ledgerState.synced_mask.every(Boolean)}
                        fullWidth
                      >
                        Post split expense
                      </Button>
                      {currentUserIdx === null ? (
                        <Typography variant="caption" color="error.main">
                          Only joined group members can post expenses.
                        </Typography>
                      ) : !ledgerState.synced_mask.every(Boolean) ? (
                        <Typography variant="caption" color="warning.main">
                          Every member must sync their previous balance before a new expense can be posted.
                        </Typography>
                      ) : null}
                    </Stack>
                  </SectionCard>
                </Grid>
              </>
            )}

            {/* TRANSACTION FEEDBACK */}
            {txStage !== 'IDLE' && (
              <Grid size={{ xs: 12 }}>
                <Fade in>
                  <Box>
                    <TxTimeline stage={txStage} error={txError} />
                  </Box>
                </Fade>
              </Grid>
            )}
          </Grid>
        )}

        {/* Developer Simulation Mode Isolated Panel (Isolated from production flow) */}
        {import.meta.env.DEV && (
          <Paper
            sx={{
              p: 3,
              mt: 6,
              borderRadius: 3.5,
              bgcolor: 'rgba(255, 255, 255, 0.02)',
              border: '1px dashed',
              borderColor: 'divider',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <SparkleIcon sx={{ color: 'warning.main', fontSize: '1.05rem' }} />
              <Typography variant="overline" color="warning.main">
                Developer diagnostics & simulation · local only
              </Typography>
            </Box>
            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 2 }}>
              Switch the acting participant on a single browser tab to exercise ledger settlements and sync states
              without four separate wallets. This panel is compiled out of the production build.
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1.5, flexWrap: 'wrap' }}>
              {[0, 1, 2, 3].map((idx) => (
                <Button
                  key={idx}
                  size="small"
                  variant="outlined"
                  color="warning"
                  onClick={async () => {
                    setWalletConnected(true);
                    setWalletAddress(`mock_wallet_address_${idx}`);
                    setCurrentUserIdx(idx);
                    setActiveUserIdx(idx);
                    if (splitsAPI) {
                      await splitsAPI.changeActiveUser(idx, secretKeys[idx]);
                    }
                  }}
                >
                  Simulate User {idx}
                </Button>
              ))}
            </Box>
          </Paper>
        )}
      </Container>

      <Footer />

      {(txStage === 'PREPARING' ||
        txStage === 'PROVING' ||
        txStage === 'AWAITING_WALLET' ||
        txStage === 'SUBMITTED' ||
        txStage === 'CONFIRMING') && (
        <LinearProgress sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: (t) => t.zIndex.appBar + 1 }} />
      )}

      <Snackbar
        open={toast.open}
        autoHideDuration={5000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={toast.severity}
          variant="standard"
          onClose={() => setToast((t) => ({ ...t, open: false }))}
          sx={{ boxShadow: '0 20px 50px -20px rgba(0,0,0,0.8)' }}
        >
          {toast.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default App;
