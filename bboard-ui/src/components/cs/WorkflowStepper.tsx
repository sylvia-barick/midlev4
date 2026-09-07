import React from 'react';
import { Box, Typography } from '@mui/material';
import {
  AccountBalanceWalletOutlined as WalletIcon,
  GroupAddOutlined as GroupIcon,
  ReceiptLongOutlined as ExpenseIcon,
  SyncOutlined as SyncIcon,
  HandshakeOutlined as SettleIcon,
  CheckRounded as CheckIcon,
} from '@mui/icons-material';

const STEPS = [
  { label: 'Connect', hint: 'Link 1AM wallet', Icon: WalletIcon },
  { label: 'Create / Join', hint: 'Open or take a slot', Icon: GroupIcon },
  { label: 'Post expense', hint: 'Record a shared cost', Icon: ExpenseIcon },
  { label: 'Sync balance', hint: 'Prove it with ZK', Icon: SyncIcon },
  { label: 'Settle', hint: 'Pay & claim', Icon: SettleIcon },
];

interface WorkflowStepperProps {
  activeStep: number;
}

/**
 * Bespoke five-stage progress rail. A single track with a filled portion up to
 * the current step, numbered nodes (check when done, glow when active), and
 * captions beneath. Replaces the stock stepper look entirely.
 */
export const WorkflowStepper: React.FC<WorkflowStepperProps> = ({ activeStep }) => {
  const pct = STEPS.length > 1 ? (Math.min(activeStep, STEPS.length - 1) / (STEPS.length - 1)) * 100 : 0;

  return (
    <Box
      sx={{
        px: { xs: 2, md: 3.5 },
        py: { xs: 2.5, md: 3 },
        borderRadius: 3.5,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'rgba(16,14,24,0.6)',
        backdropFilter: 'blur(12px)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: `repeat(${STEPS.length}, 1fr)` },
          gap: { xs: 2, sm: 0 },
          position: 'relative',
        }}
      >
        {/* track (desktop) */}
        <Box
          aria-hidden
          sx={{
            display: { xs: 'none', sm: 'block' },
            position: 'absolute',
            left: `${100 / STEPS.length / 2}%`,
            right: `${100 / STEPS.length / 2}%`,
            top: 19,
            height: 2,
            borderRadius: 2,
            bgcolor: 'rgba(255,255,255,0.08)',
          }}
        />
        <Box
          aria-hidden
          sx={{
            display: { xs: 'none', sm: 'block' },
            position: 'absolute',
            left: `${100 / STEPS.length / 2}%`,
            width: `calc((100% - ${100 / STEPS.length}%) * ${pct / 100})`,
            top: 19,
            height: 2,
            borderRadius: 2,
            background: 'linear-gradient(90deg, #8b5cf6, #2dd4bf)',
            transition: 'width 500ms cubic-bezier(.2,.7,.2,1)',
            boxShadow: '0 0 12px rgba(139,92,246,0.6)',
          }}
        />

        {STEPS.map((s, i) => {
          const done = i < activeStep;
          const active = i === activeStep;
          const Icon = s.Icon;
          return (
            <Box
              key={s.label}
              sx={{
                display: 'flex',
                flexDirection: { xs: 'row', sm: 'column' },
                alignItems: 'center',
                gap: { xs: 1.5, sm: 1 },
                textAlign: { xs: 'left', sm: 'center' },
                position: 'relative',
                zIndex: 1,
              }}
            >
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  flexShrink: 0,
                  display: 'grid',
                  placeItems: 'center',
                  border: '1px solid',
                  transition: 'all 240ms cubic-bezier(.2,.7,.2,1)',
                  color: done ? '#03211d' : active ? '#fff' : 'text.disabled',
                  bgcolor: done ? 'secondary.main' : active ? 'primary.main' : 'rgba(16,14,24,0.9)',
                  borderColor: done ? 'secondary.main' : active ? 'primary.main' : 'divider',
                  boxShadow: active
                    ? '0 0 0 5px rgba(139,92,246,0.18), 0 8px 20px -8px rgba(139,92,246,0.9)'
                    : done
                      ? '0 6px 16px -8px rgba(45,212,191,0.8)'
                      : 'none',
                }}
              >
                {done ? <CheckIcon sx={{ fontSize: '1.15rem' }} /> : <Icon sx={{ fontSize: '1.1rem' }} />}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontSize: '0.82rem',
                    lineHeight: 1.2,
                    color: done || active ? 'text.primary' : 'text.secondary',
                  }}
                >
                  <Box
                    component="span"
                    sx={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '0.68rem',
                      color: active ? 'primary.light' : 'text.disabled',
                      mr: 0.75,
                    }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </Box>
                  {s.label}
                </Typography>
                <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.68rem' }}>
                  {s.hint}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
