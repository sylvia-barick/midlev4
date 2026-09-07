import React, { useState } from 'react';
import { Box, Tooltip } from '@mui/material';
import { ContentCopyRounded as CopyIcon, CheckRounded as CheckIcon } from '@mui/icons-material';

interface MonoTagProps {
  value: string;
  /** Characters kept at each end when truncating. 0 = show in full. */
  truncate?: number;
  copyable?: boolean;
  color?: string;
}

/**
 * A compact monospace chip for on-chain values (addresses, commitments,
 * salts). Truncates the middle, and the whole chip is a copy button.
 */
export const MonoTag: React.FC<MonoTagProps> = ({ value, truncate = 8, copyable = true, color }) => {
  const [copied, setCopied] = useState(false);

  const shown =
    truncate > 0 && value.length > truncate * 2 + 3
      ? `${value.slice(0, truncate)}····${value.slice(-truncate)}`
      : value;

  const handleCopy = () => {
    void navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <Tooltip title={copied ? 'Copied to clipboard' : copyable ? 'Click to copy' : ''} placement="top" arrow>
      <Box
        onClick={copyable ? handleCopy : undefined}
        role={copyable ? 'button' : undefined}
        tabIndex={copyable ? 0 : undefined}
        onKeyDown={(e) => {
          if (copyable && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            handleCopy();
          }
        }}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75,
          px: 1,
          py: 0.4,
          borderRadius: 1.75,
          maxWidth: '100%',
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: '0.76rem',
          letterSpacing: '0.01em',
          color: copied ? 'success.light' : (color ?? 'text.secondary'),
          bgcolor: 'rgba(7,6,11,0.55)',
          border: '1px solid',
          borderColor: copied ? 'success.main' : 'divider',
          cursor: copyable ? 'pointer' : 'default',
          transition: 'border-color 140ms ease, color 140ms ease, background-color 140ms ease',
          outline: 'none',
          '&:hover': copyable
            ? { borderColor: 'primary.light', color: 'text.primary', bgcolor: 'rgba(139,92,246,0.08)' }
            : undefined,
          '&:focus-visible': { borderColor: 'primary.light', boxShadow: '0 0 0 3px rgba(139,92,246,0.25)' },
        }}
      >
        <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {shown}
        </Box>
        {copyable &&
          (copied ? (
            <CheckIcon sx={{ fontSize: 13, color: 'success.main' }} />
          ) : (
            <CopyIcon sx={{ fontSize: 13, opacity: 0.55 }} />
          ))}
      </Box>
    </Tooltip>
  );
};
