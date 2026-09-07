import React from 'react';
import { Box, Typography, CircularProgress, Collapse, Alert } from '@mui/material';
import { CheckRounded as DoneIcon, CloseRounded as FailIcon } from '@mui/icons-material';

export type TxStage =
  | 'IDLE'
  | 'PREPARING'
  | 'PROVING'
  | 'AWAITING_WALLET'
  | 'SUBMITTED'
  | 'CONFIRMING'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'FAILED';

const FLOW: { key: TxStage; label: string; note: string }[] = [
  { key: 'PREPARING', label: 'Prepare', note: 'Building circuit inputs' },
  { key: 'PROVING', label: 'Prove', note: 'Generating the ZK proof' },
  { key: 'AWAITING_WALLET', label: 'Sign', note: 'Awaiting wallet approval' },
  { key: 'SUBMITTED', label: 'Submit', note: 'Broadcast to Preprod' },
  { key: 'CONFIRMED', label: 'Confirm', note: 'Included in a block' },
];

const order = (s: TxStage): number => {
  const map: Record<string, number> = {
    IDLE: -1,
    PREPARING: 0,
    PROVING: 1,
    AWAITING_WALLET: 2,
    SUBMITTED: 3,
    CONFIRMING: 3,
    CONFIRMED: 4,
    REJECTED: 4,
    FAILED: 99,
  };
  return map[s] ?? -1;
};

interface TxTimelineProps {
  stage: TxStage;
  error?: string;
}

/**
 * Horizontal progress rail for the in-flight transaction. Phases light up as
 * the transaction advances; a failure marks the reached phase red and reveals
 * the error beneath.
 */
export const TxTimeline: React.FC<TxTimelineProps> = ({ stage, error }) => {
  if (stage === 'IDLE') return null;
  const failed = stage === 'FAILED' || stage === 'REJECTED';
  const done = stage === 'CONFIRMED';
  const current = order(stage);

  return (
    <Box
      sx={{
        p: { xs: 2.25, md: 2.75 },
        borderRadius: 3.5,
        border: '1px solid',
        borderColor: failed ? 'error.main' : done ? 'success.main' : 'primary.main',
        bgcolor: failed ? 'rgba(248,113,113,0.06)' : done ? 'rgba(52,211,153,0.05)' : 'rgba(139,92,246,0.05)',
        animation: 'cs-rise 320ms ease both',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 2.25 }}>
        {failed ? (
          <Box
            sx={{
              display: 'grid',
              placeItems: 'center',
              width: 22,
              height: 22,
              borderRadius: '50%',
              bgcolor: 'error.main',
              color: '#1a0606',
            }}
          >
            <FailIcon sx={{ fontSize: 15 }} />
          </Box>
        ) : done ? (
          <Box
            sx={{
              display: 'grid',
              placeItems: 'center',
              width: 22,
              height: 22,
              borderRadius: '50%',
              bgcolor: 'success.main',
              color: '#03211d',
            }}
          >
            <DoneIcon sx={{ fontSize: 15 }} />
          </Box>
        ) : (
          <CircularProgress size={16} thickness={5} />
        )}
        <Typography variant="subtitle2" sx={{ letterSpacing: '0.02em' }}>
          {failed ? 'Transaction failed' : done ? 'Confirmed on Midnight Preprod' : 'Transaction in progress'}
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: `repeat(${FLOW.length}, 1fr)` },
          gap: { xs: 1.25, sm: 0 },
        }}
      >
        {FLOW.map((phase, i) => {
          const isDone = !failed && current > i;
          const isActive = !failed && current === i;
          const isFail = failed && i === Math.min(current, FLOW.length - 1);
          const dotColor = isFail
            ? 'error.main'
            : isDone
              ? 'success.main'
              : isActive
                ? 'primary.main'
                : 'rgba(255,255,255,0.14)';
          return (
            <Box key={phase.key} sx={{ position: 'relative' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ position: 'relative', width: 11, height: 11, flexShrink: 0 }}>
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '50%',
                      bgcolor: dotColor,
                      boxShadow: isActive ? '0 0 0 4px rgba(139,92,246,0.2)' : 'none',
                    }}
                  />
                  {isActive && (
                    <Box
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: '50%',
                        bgcolor: 'primary.main',
                        animation: 'cs-ping 1.6s ease-out infinite',
                      }}
                    />
                  )}
                </Box>
                <Box
                  sx={{
                    display: { xs: 'none', sm: 'block' },
                    flexGrow: 1,
                    height: 2,
                    borderRadius: 2,
                    mr: i === FLOW.length - 1 ? 0 : -1,
                    background: isDone ? 'linear-gradient(90deg,#34d399,#2dd4bf)' : 'rgba(255,255,255,0.08)',
                  }}
                />
              </Box>
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  mt: 0.9,
                  fontWeight: isActive || isDone ? 700 : 500,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  fontSize: '0.66rem',
                  color: isActive ? 'primary.light' : isDone ? 'text.primary' : 'text.disabled',
                }}
              >
                {phase.label}
              </Typography>
              <Typography
                variant="caption"
                color="text.disabled"
                sx={{ display: { xs: 'none', md: 'block' }, fontSize: '0.66rem' }}
              >
                {phase.note}
              </Typography>
            </Box>
          );
        })}
      </Box>

      <Collapse in={failed && !!error}>
        <Alert severity="error" sx={{ mt: 2.25 }}>
          {error}
        </Alert>
      </Collapse>
    </Box>
  );
};
