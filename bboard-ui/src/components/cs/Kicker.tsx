import React from 'react';
import { Box, Typography } from '@mui/material';

interface KickerProps {
  /** Editorial index, e.g. "01". Rendered in mono. */
  index?: string;
  label: string;
  color?: string;
}

/**
 * Small editorial section label: a mono index, a tick, then an all-caps
 * tracked title. Gives each block a magazine-like anchor.
 */
export const Kicker: React.FC<KickerProps> = ({ index, label, color = '#a78bfa' }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
    {index && (
      <Typography
        component="span"
        sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem', fontWeight: 600, color }}
      >
        {index}
      </Typography>
    )}
    <Box sx={{ width: 14, height: 1, bgcolor: color, opacity: 0.5 }} />
    <Typography
      component="span"
      sx={{
        fontSize: '0.68rem',
        fontWeight: 700,
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        color: 'text.secondary',
      }}
    >
      {label}
    </Typography>
  </Box>
);
