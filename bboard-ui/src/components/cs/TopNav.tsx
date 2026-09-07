import React from 'react';
import { AppBar, Toolbar, Box, Typography, Tooltip } from '@mui/material';
import { AccountBalanceWalletOutlined as WalletIcon } from '@mui/icons-material';
import { BrandMark } from './BrandMark';

interface TopNavProps {
  network: string;
  walletConnected: boolean;
  walletLabel?: string;
  roleLabel?: string;
  infraHealthy: boolean;
}

const LiveDot: React.FC<{ ok: boolean }> = ({ ok }) => (
  <Box sx={{ position: 'relative', width: 8, height: 8, flexShrink: 0 }}>
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        borderRadius: '50%',
        bgcolor: ok ? '#34d399' : '#fbbf24',
        boxShadow: `0 0 10px ${ok ? '#34d399' : '#fbbf24'}`,
      }}
    />
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        borderRadius: '50%',
        bgcolor: ok ? '#34d399' : '#fbbf24',
        animation: 'cs-ping 2s ease-out infinite',
      }}
    />
  </Box>
);

const Pill: React.FC<React.PropsWithChildren<{ mono?: boolean }>> = ({ children, mono }) => (
  <Box
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 0.75,
      px: 1.1,
      py: 0.5,
      borderRadius: 2,
      border: '1px solid',
      borderColor: 'divider',
      bgcolor: 'rgba(255,255,255,0.03)',
      fontSize: '0.74rem',
      fontWeight: 600,
      letterSpacing: mono ? 0 : '0.02em',
      fontFamily: mono ? "'JetBrains Mono', monospace" : undefined,
      color: 'text.secondary',
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </Box>
);

/**
 * Sticky application bar. Brand on the left; on the right a live network +
 * infrastructure lamp and either the wallet-address pill or a "not connected"
 * hint.
 */
export const TopNav: React.FC<TopNavProps> = ({ network, walletConnected, walletLabel, roleLabel, infraHealthy }) => (
  <AppBar position="sticky" elevation={0}>
    <Toolbar sx={{ maxWidth: 1200, mx: 'auto', width: '100%', gap: 1.5, py: 1.1, px: { xs: 2, sm: 3 }, minHeight: 64 }}>
      <BrandMark compact />
      <Box sx={{ flexGrow: 1 }} />

      <Tooltip
        arrow
        title={
          infraHealthy
            ? 'Midnight RPC, indexer and proof server all reachable'
            : 'One or more Midnight services are unreachable'
        }
      >
        <Box sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
          <Pill>
            <LiveDot ok={infraHealthy} />
            {network.toUpperCase()}
          </Pill>
        </Box>
      </Tooltip>

      {walletConnected ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.4 }}>
          <Pill mono>
            <WalletIcon sx={{ fontSize: '0.95rem', color: 'primary.light' }} />
            {walletLabel}
          </Pill>
          {roleLabel && (
            <Typography variant="caption" color="text.disabled" sx={{ pr: 0.5, fontSize: '0.68rem' }}>
              {roleLabel}
            </Typography>
          )}
        </Box>
      ) : (
        <Pill>Wallet not connected</Pill>
      )}
    </Toolbar>
  </AppBar>
);
