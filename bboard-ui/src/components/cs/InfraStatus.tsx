import React from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';

type CheckState = 'CHECKING' | 'CONNECTED' | 'FAILED';

interface InfraStatusRowProps {
  icon: React.ReactNode;
  label: string;
  detail: string;
  state: CheckState;
}

const meta: Record<CheckState, { color: string; text: string }> = {
  CHECKING: { color: '#fbbf24', text: 'Checking' },
  CONNECTED: { color: '#34d399', text: 'Online' },
  FAILED: { color: '#f87171', text: 'Offline' },
};

/**
 * One service line in the "Midnight infrastructure" panel: icon, name, the
 * endpoint in mono, and a live status lamp with a soft glow.
 */
export const InfraStatusRow: React.FC<InfraStatusRowProps> = ({ icon, label, detail, state }) => {
  const m = meta[state];
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        py: 1.25,
        px: 1.5,
        borderRadius: 2.5,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'rgba(7,6,11,0.4)',
        transition: 'border-color 160ms ease, background-color 160ms ease',
        '&:hover': { borderColor: 'rgba(255,255,255,0.14)', bgcolor: 'rgba(7,6,11,0.6)' },
      }}
    >
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: 2,
          flexShrink: 0,
          display: 'grid',
          placeItems: 'center',
          color: 'text.secondary',
          bgcolor: 'rgba(255,255,255,0.03)',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        {icon}
      </Box>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.84rem' }}>
          {label}
        </Typography>
        <Typography
          variant="caption"
          color="text.disabled"
          sx={{ fontFamily: "'JetBrains Mono', monospace", wordBreak: 'break-all', fontSize: '0.68rem' }}
        >
          {detail}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.9, flexShrink: 0 }}>
        {state === 'CHECKING' ? (
          <CircularProgress size={11} thickness={6} sx={{ color: m.color }} />
        ) : (
          <Box sx={{ position: 'relative', width: 8, height: 8 }}>
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                bgcolor: m.color,
                boxShadow: `0 0 10px ${m.color}`,
              }}
            />
            {state === 'CONNECTED' && (
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  bgcolor: m.color,
                  animation: 'cs-ping 2.4s ease-out infinite',
                }}
              />
            )}
          </Box>
        )}
        <Typography
          variant="caption"
          sx={{
            color: m.color,
            fontWeight: 700,
            fontSize: '0.7rem',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            minWidth: 52,
            textAlign: 'right',
          }}
        >
          {m.text}
        </Typography>
      </Box>
    </Box>
  );
};
