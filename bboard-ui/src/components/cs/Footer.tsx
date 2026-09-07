import React from 'react';
import { Box, Container, Typography, Link } from '@mui/material';
import { NorthEastRounded as OutIcon } from '@mui/icons-material';
import { BrandMark } from './BrandMark';

const LINKS = [
  { label: 'Repository', href: 'https://github.com/sylvia-barick/midlev4' },
  { label: 'Live demo', href: 'https://midlev4.vercel.app/' },
  { label: 'Midnight docs', href: 'https://docs.midnight.network/' },
];

/**
 * Page footer: brand, the privacy one-liner, canonical links, and a testnet
 * disclaimer.
 */
export const Footer: React.FC = () => (
  <Box component="footer" sx={{ mt: { xs: 6, md: 10 }, pb: 5, position: 'relative', zIndex: 1 }}>
    <Container maxWidth="lg">
      <Box
        sx={{
          borderTop: '1px solid',
          borderColor: 'divider',
          pt: 3.5,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 3,
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ maxWidth: 440 }}>
          <BrandMark />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.25, lineHeight: 1.7 }}>
            Balances, blinding salts and ZK witness keys stay on your device. Only cryptographic commitments and
            settlement metadata are ever written to the public Midnight ledger.
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2.5 }}>
          {LINKS.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              target="_blank"
              rel="noopener"
              underline="none"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                fontSize: '0.82rem',
                fontWeight: 500,
                color: 'text.secondary',
                transition: 'color 140ms ease',
                '&:hover': { color: 'text.primary' },
                '&:hover .out': { transform: 'translate(2px,-2px)' },
              }}
            >
              {l.label}
              <OutIcon className="out" sx={{ fontSize: '0.9rem', transition: 'transform 140ms ease' }} />
            </Link>
          ))}
        </Box>
      </Box>

      <Typography
        variant="caption"
        color="text.disabled"
        sx={{ display: 'block', mt: 3, fontFamily: "'JetBrains Mono', monospace", fontSize: '0.68rem' }}
      >
        Built on the Midnight Network · Preprod testnet · tNight has no monetary value
      </Typography>
    </Container>
  </Box>
);
