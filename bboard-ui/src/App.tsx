import React, { useEffect, useState, useContext } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  CircularProgress,
  Alert,
  Paper,
  Divider,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  Chip,
} from '@mui/material';
import {
  Dns as RpcIcon,
  Storage as IndexerIcon,
  Security as ProverIcon,
  Sync as SyncIcon,
  AddCircleOutlined as ExpenseIcon,
  GroupAdd as GroupIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { DeployedSplitsContext } from './contexts/DeployedSplitsContext';
import { SplitsAPI, type SplitsDerivedState } from '../../api/src/index';
import { type Observable } from 'rxjs';
import { type SplitsDeployment, type DeployedSplitsDeployment } from './contexts/BrowserDeployedSplitsManager';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { calculateSettlement, type ParticipantBalance } from '@midnight-ntwrk/bboard-contract';
import * as Splits from '../../contract/src/managed/splits/contract/index.js';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';

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
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
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
      setTxError('Wallet connection failed.');
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
      setTxStage('PROVING');

      // Calculate active members count
      const activeMembers = ledgerState.members.filter(
        (m) => m !== '0000000000000000000000000000000000000000000000000000000000000000',
      );
      const activeCount = BigInt(activeMembers.length);

      // Equal split among active members only
      const shareVal = amountVal / activeCount;
      const remainder = amountVal % activeCount;

      const shares = [0n, 0n, 0n, 0n];
      let assignedIndex = 0;
      ledgerState.members.forEach((m, idx) => {
        if (m !== '0000000000000000000000000000000000000000000000000000000000000000') {
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
      if (member !== '0000000000000000000000000000000000000000000000000000000000000000') {
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

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* 1. Header & Switcher */}
      <Box
        sx={{ mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <img src="/logo.png" alt="Confidential Splits Logo" style={{ height: '100px', objectFit: 'contain' }} />
          <Box>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: 'primary.main', letterSpacing: '1px' }}>
              CONFIDENTIAL SPLITS
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              Privacy-Preserving Group Settlements on Midnight
            </Typography>
          </Box>
        </Box>
        {walletConnected && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
            <Chip label="1AM Wallet Connected" color="success" variant="outlined" size="small" />
            <Typography variant="caption" color="text.secondary">
              Wallet:{' '}
              {walletAddress.startsWith('mock_wallet_address_')
                ? walletAddress
                : `${walletAddress.slice(0, 8)}...${walletAddress.slice(-8)}`}
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'primary.light' }}>
              Role: {currentUserIdx !== null ? `Member (User ${currentUserIdx})` : 'Guest Viewer'}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Invite Landing Banner */}
      {inviteAddress && !splitsAPI && (
        <Alert severity="info" sx={{ mb: 4 }} icon={<GroupIcon />}>
          You have been invited to join group: <strong>{inviteAddress.slice(0, 16)}...</strong>. Connect your wallet and
          join an empty slot below to participate.
        </Alert>
      )}

      {/* 2. Wallet & Diagnostic Landing Panel */}
      {!walletConnected ? (
        <Grid container spacing={4}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper elevation={3} sx={{ p: 4, height: '100%', borderRadius: 3 }}>
              <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 3 }}>
                Connect Wallet
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                Please connect your 1AM Wallet to begin. The DApp will verify your Preprod connection stage, unshielded
                addresses, and network compatibility.
              </Typography>

              {txError && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  {txError}
                </Alert>
              )}

              <Button
                variant="contained"
                size="large"
                color="primary"
                onClick={() => void connectOneAm()}
                fullWidth
                disabled={oneAmDetected === false}
                sx={{ py: 1.5, borderRadius: 2 }}
              >
                Connect 1AM Wallet
              </Button>
              {oneAmDetected === false && (
                <Typography variant="caption" color="error" sx={{ mt: 2, display: 'block' }}>
                  1AM Wallet extension not detected in browser. Please install or enable it.
                </Typography>
              )}
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
                Midnight Infrastructure Status
              </Typography>
              <List>
                <ListItem>
                  <RpcIcon sx={{ mr: 2, color: rpcStatus === 'CONNECTED' ? 'success.main' : 'error.main' }} />
                  <ListItemText primary="Midnight Preprod RPC" secondary={rpcStatus} />
                </ListItem>
                <Divider />
                <ListItem>
                  <IndexerIcon sx={{ mr: 2, color: indexerStatus === 'CONNECTED' ? 'success.main' : 'error.main' }} />
                  <ListItemText primary="GraphQL Indexer Server" secondary={indexerStatus} />
                </ListItem>
                <Divider />
                <ListItem>
                  <ProverIcon
                    sx={{ mr: 2, color: proofServerStatus === 'CONNECTED' ? 'success.main' : 'error.main' }}
                  />
                  <ListItemText primary="Local Proof Server (Port 6300)" secondary={proofServerStatus} />
                </ListItem>
              </List>
            </Paper>
          </Grid>
        </Grid>
      ) : (
        /* 3. Main Dashboard View (Connected) */
        <Grid container spacing={4}>
          {/* Active Contract Info */}
          <Grid size={{ xs: 12 }}>
            <Paper elevation={3} sx={{ p: 3, borderRadius: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 'bold', mb: 1 }}>
                CURRENT GROUP LEDGER ADDRESS
              </Typography>
              {latestContractAddress ? (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 2,
                  }}
                >
                  <Typography
                    variant="body1"
                    sx={{ fontFamily: 'monospace', fontWeight: 'bold', wordBreak: 'break-all', color: 'primary.light' }}
                  >
                    {latestContractAddress}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1.5 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      color="secondary"
                      startIcon={<CopyIcon />}
                      onClick={copyInviteLink}
                    >
                      {copiedLink ? 'Copied Invite!' : 'Copy Invite Link'}
                    </Button>
                  </Box>
                </Box>
              ) : (
                <Box sx={{ mt: 1, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <TextField
                    size="small"
                    label="Splits Contract Address"
                    value={splitsAddressInput}
                    onChange={(e) => setSplitsAddressInput(e.target.value)}
                    sx={{ minWidth: 300 }}
                  />
                  <Button variant="contained" onClick={() => void handleConnectToGroup()}>
                    Join Group
                  </Button>
                  <Divider orientation="vertical" flexItem />
                  <TextField
                    size="small"
                    label="New Group Name"
                    value={groupNameInput}
                    onChange={(e) => setGroupNameInput(e.target.value)}
                    sx={{ minWidth: 200 }}
                  />
                  <Button variant="contained" color="success" onClick={() => void handleCreateGroup()}>
                    Create Group
                  </Button>
                </Box>
              )}
            </Paper>
          </Grid>

          {ledgerState && (
            <>
              {/* PUBLIC LEDGER STATE */}
              <Grid size={{ xs: 12, md: 7 }}>
                <Paper elevation={3} sx={{ p: 3, borderRadius: 3, height: '100%' }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#ab47bc', mb: 2 }}>
                    PUBLIC GROUP DATA (ON-CHAIN)
                  </Typography>
                  <Divider sx={{ mb: 2 }} />

                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                    Participants & Membership Slots:
                  </Typography>
                  <List dense>
                    {ledgerState.members.map((member: string, i: number) => {
                      const isEmpty = member === '0000000000000000000000000000000000000000000000000000000000000000';
                      const isCurrentUserMember = currentUserIdx !== null;

                      return (
                        <ListItem
                          key={i}
                          sx={{ px: 0 }}
                          secondaryAction={
                            isEmpty && !isCurrentUserMember ? (
                              <Button
                                size="small"
                                variant="contained"
                                color="primary"
                                onClick={() => void handleJoinSlot(i)}
                              >
                                Join Slot
                              </Button>
                            ) : !isEmpty ? (
                              <Chip
                                label={ledgerState.synced_mask[i] ? 'Synced' : 'Sync Pending'}
                                color={ledgerState.synced_mask[i] ? 'success' : 'warning'}
                                size="small"
                                variant="outlined"
                              />
                            ) : (
                              <Typography variant="caption" color="text.secondary">
                                Vacant
                              </Typography>
                            )
                          }
                        >
                          <ListItemText
                            primary={`User ${i} ${i === 0 ? '(Creator)' : ''}`}
                            secondary={isEmpty ? 'Vacant Slot' : `${member.slice(0, 16)}...${member.slice(-16)}`}
                          />
                        </ListItem>
                      );
                    })}
                  </List>

                  <Box sx={{ mt: 3, p: 2, bgcolor: 'rgba(171, 71, 188, 0.15)', borderRadius: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, color: 'primary.light' }}>
                      Pending Expense Log:
                    </Typography>
                    <Typography variant="body2">Payer: **User {ledgerState.pending_expense_payer_idx}**</Typography>
                    <Typography variant="body2">
                      Amount: **{ledgerState.pending_expense_amount.toString()} tNight**
                    </Typography>
                    <Typography variant="body2">
                      Shares Split: [{ledgerState.pending_expense_shares.map((s: bigint) => s.toString()).join(', ')}]
                    </Typography>
                  </Box>

                  {ledgerState.pending_payment_status === 1n && (
                    <Box
                      sx={{
                        mt: 2,
                        p: 2,
                        bgcolor: 'rgba(76, 175, 80, 0.15)',
                        borderRadius: 2,
                        border: '1px solid rgba(76, 175, 80, 0.3)',
                      }}
                    >
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.5, color: '#81c784' }}>
                        Pending Settlement Payment Log:
                      </Typography>
                      <Typography variant="body2">
                        Debtor: **User {ledgerState.pending_payment_from.toString()}**
                      </Typography>
                      <Typography variant="body2">
                        Creditor: **User {ledgerState.pending_payment_to.toString()}**
                      </Typography>
                      <Typography variant="body2">
                        Amount: **{ledgerState.pending_payment_amount.toString()} tNight**
                      </Typography>
                    </Box>
                  )}
                </Paper>
              </Grid>

              {/* SHIELDED PRIVATE STATE */}
              <Grid size={{ xs: 12, md: 5 }}>
                <Paper elevation={3} sx={{ p: 3, borderRadius: 3, height: '100%', border: '1px solid #a5d6a7' }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#81c784', mb: 2 }}>
                    YOUR PRIVATE DATA (SHIELDED)
                  </Typography>
                  <Divider sx={{ mb: 2 }} />

                  {currentUserIdx !== null ? (
                    <>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          Active User Index:
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                          User {currentUserIdx}
                        </Typography>
                      </Box>

                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          Private Net Balance:
                        </Typography>
                        <Typography
                          variant="h5"
                          sx={{
                            fontWeight: 'bold',
                            color: (ledgerState.balances[currentUserIdx] || 0n) >= 0n ? '#81c784' : '#ef5350',
                          }}
                        >
                          {((ledgerState.balances[currentUserIdx] || 0n) >= 0n ? '+' : '') +
                            (ledgerState.balances[currentUserIdx] || 0n).toString()}{' '}
                          tNight
                        </Typography>
                      </Box>

                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          Private Blinding Salt:
                        </Typography>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                          {ledgerState.salts[currentUserIdx]}
                        </Typography>
                      </Box>

                      <Box sx={{ mb: 3 }}>
                        <Typography variant="body2" color="text.secondary">
                          On-Chain Balance Commitment:
                        </Typography>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                          {ledgerState.balance_commitments[currentUserIdx]}
                        </Typography>
                      </Box>

                      {!ledgerState.synced_mask[currentUserIdx] ? (
                        <Button
                          variant="contained"
                          color="success"
                          startIcon={<SyncIcon />}
                          fullWidth
                          onClick={() => void handleSyncBalance()}
                        >
                          Sync Private Balance (ZK Proof)
                        </Button>
                      ) : (
                        <Alert severity="info">
                          Your shielded balance is fully synced with the latest ledger expense.
                        </Alert>
                      )}
                    </>
                  ) : (
                    <Box sx={{ py: 4, textAlign: 'center' }}>
                      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                        You are viewing this group as a guest.
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        To participate and view your private shielded state, please join an empty slot on the left
                        panel.
                      </Typography>
                    </Box>
                  )}
                </Paper>
              </Grid>

              {/* SETTLEMENT ENGINE */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Paper elevation={3} sx={{ p: 3, borderRadius: 3, height: '100%' }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
                    Optimized Settlements (Greedy Cash Flow)
                  </Typography>
                  <Divider sx={{ mb: 2 }} />

                  {isSettlementValid ? (
                    optimizedSettlements.length === 0 ? (
                      <Alert severity="success">All users are fully settled! Net balances are 0.</Alert>
                    ) : (
                      <List>
                        {optimizedSettlements.map((settle, i) => {
                          const isActiveDebtor = currentUserIdx !== null && settle.debtor === currentUserIdx;
                          const isActiveCreditor = currentUserIdx !== null && settle.creditor === currentUserIdx;
                          const hasPendingPayment = ledgerState.pending_payment_status === 1n;

                          return (
                            <ListItem
                              key={i}
                              secondaryAction={
                                isActiveDebtor && !hasPendingPayment ? (
                                  <Button
                                    size="small"
                                    variant="contained"
                                    color="warning"
                                    onClick={() =>
                                      void handlePostPayment(settle.debtor, settle.creditor, settle.amount)
                                    }
                                  >
                                    Pay Settlement
                                  </Button>
                                ) : isActiveCreditor && hasPendingPayment ? (
                                  <Button
                                    size="small"
                                    variant="contained"
                                    color="success"
                                    onClick={() => void handleClaimPayment()}
                                  >
                                    Claim Payment
                                  </Button>
                                ) : null
                              }
                            >
                              <ListItemText
                                primary={`User ${settle.debtor} ➔ User ${settle.creditor}`}
                                secondary={`${settle.amount.toString()} tNight`}
                              />
                            </ListItem>
                          );
                        })}
                      </List>
                    )
                  ) : (
                    <Alert severity="error">{validationError}</Alert>
                  )}
                </Paper>
              </Grid>

              {/* POST EXPENSE ACTION */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Paper elevation={3} sx={{ p: 3, borderRadius: 3, height: '100%' }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
                    Post New Group Expense
                  </Typography>
                  <Divider sx={{ mb: 2 }} />

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <FormControl size="small" disabled={currentUserIdx === null}>
                      <InputLabel>Expense Payer</InputLabel>
                      <Select
                        value={expensePayer}
                        label="Expense Payer"
                        onChange={(e) => setExpensePayer(Number(e.target.value))}
                      >
                        {ledgerState.members.map((member, i) => {
                          if (member !== '0000000000000000000000000000000000000000000000000000000000000000') {
                            return (
                              <MenuItem key={i} value={i}>
                                {currentUserIdx === i ? `You (User ${i})` : `User ${i} (${member.slice(0, 8)}...)`}
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
                    />

                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={<ExpenseIcon />}
                      onClick={() => void handlePostExpense()}
                      disabled={currentUserIdx === null || !ledgerState.synced_mask.every(Boolean)}
                    >
                      Post Split Expense
                    </Button>
                    {currentUserIdx === null ? (
                      <Typography variant="caption" color="error.main">
                        Only joined group members can post expenses.
                      </Typography>
                    ) : !ledgerState.synced_mask.every(Boolean) ? (
                      <Typography variant="caption" color="warning.main">
                        All users must sync their previous balances before posting a new expense.
                      </Typography>
                    ) : null}
                  </Box>
                </Paper>
              </Grid>
            </>
          )}

          {/* TRANSACTION FEEDBACK STAGE BAR */}
          {txStage !== 'IDLE' && (
            <Grid size={{ xs: 12 }}>
              <Paper elevation={3} sx={{ p: 3, borderRadius: 3, borderLeft: '5px solid #29b6f6' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  {txStage !== 'CONFIRMED' && txStage !== 'FAILED' && <CircularProgress size={20} />}
                  <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                    Transaction Phase: {txStage}
                  </Typography>
                </Box>
                {txStage === 'CONFIRMED' && (
                  <Alert severity="success" sx={{ mt: 2 }}>
                    Transaction executed and confirmed on Preprod!
                  </Alert>
                )}
                {txStage === 'FAILED' && (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    {txError}
                  </Alert>
                )}
              </Paper>
            </Grid>
          )}
        </Grid>
      )}

      {/* Developer Simulation Mode Isolated Panel (Isolated from production flow) */}
      {import.meta.env.DEV && (
        <Paper
          elevation={3}
          sx={{ p: 3, mt: 6, bgcolor: 'rgba(255, 255, 255, 0.03)', border: '1px dashed #666', borderRadius: 3 }}
        >
          <Typography variant="subtitle2" color="warning.main" sx={{ fontWeight: 'bold', mb: 2 }}>
            🚧 DEVELOPER DIAGNOSTICS & SIMULATION PANEL (LOCAL DEV ONLY)
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            Simulate role switching locally on a single browser tab to verify ledger settlements and sync states.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              size="small"
              variant="outlined"
              color="warning"
              onClick={async () => {
                setWalletConnected(true);
                setWalletAddress('mock_wallet_address_0');
                setCurrentUserIdx(0);
                setActiveUserIdx(0);
                if (splitsAPI) {
                  await splitsAPI.changeActiveUser(0, secretKeys[0]);
                }
              }}
            >
              Simulate User 0
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="warning"
              onClick={async () => {
                setWalletConnected(true);
                setWalletAddress('mock_wallet_address_1');
                setCurrentUserIdx(1);
                setActiveUserIdx(1);
                if (splitsAPI) {
                  await splitsAPI.changeActiveUser(1, secretKeys[1]);
                }
              }}
            >
              Simulate User 1
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="warning"
              onClick={async () => {
                setWalletConnected(true);
                setWalletAddress('mock_wallet_address_2');
                setCurrentUserIdx(2);
                setActiveUserIdx(2);
                if (splitsAPI) {
                  await splitsAPI.changeActiveUser(2, secretKeys[2]);
                }
              }}
            >
              Simulate User 2
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="warning"
              onClick={async () => {
                setWalletConnected(true);
                setWalletAddress('mock_wallet_address_3');
                setCurrentUserIdx(3);
                setActiveUserIdx(3);
                if (splitsAPI) {
                  await splitsAPI.changeActiveUser(3, secretKeys[3]);
                }
              }}
            >
              Simulate User 3
            </Button>
          </Box>
        </Paper>
      )}
    </Container>
  );
};

export default App;
