import React from 'react';
import { Box, Typography } from '@mui/material';

interface BrandMarkProps {
  tagline?: boolean;
  size?: number;
  compact?: boolean;
}

/**
 * Logo lock-up: a crisp bordered monogram tile + the wordmark, optionally
 * with a tagline. Deliberately restrained — no gradient blob.
 */
export const BrandMark: React.FC<BrandMarkProps> = ({ tagline = false, size = 34, compact = false }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: 2,
        flexShrink: 0,
        display: 'grid',
        placeItems: 'center',
        position: 'relative',
        bgcolor: 'rgba(139,92,246,0.12)',
        border: '1px solid rgba(167,139,250,0.35)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 6px 18px -10px rgba(139,92,246,0.9)',
        overflow: 'hidden',
        '&::after': {
          content: '""',
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(150deg, rgba(255,255,255,0.14), transparent 45%)',
        },
      }}
    >
      <img
        src="/logo.png"
        alt="Confidential Splits"
        style={{ width: '68%', height: '68%', objectFit: 'contain', position: 'relative', zIndex: 1 }}
      />
    </Box>
    <Box sx={{ lineHeight: 1.05 }}>
      <Typography
        component="span"
        sx={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 700,
          fontSize: compact ? '0.98rem' : '1.1rem',
          letterSpacing: '-0.02em',
          display: 'block',
          color: 'text.primary',
        }}
      >
        Confidential&nbsp;Splits
      </Typography>
      {tagline && (
        <Typography component="span" sx={{ fontSize: '0.72rem', color: 'text.secondary', letterSpacing: '0.02em' }}>
          Private group settlements on Midnight
        </Typography>
      )}
    </Box>
  </Box>
);
