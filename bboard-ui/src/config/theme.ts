import { createTheme, alpha } from '@mui/material';

/**
 * Confidential Splits — "Midnight Ledger" design system.
 *
 * A near-black, high-contrast surface with one confident violet accent for
 * actions and a single teal reserved for anything that represents the
 * viewer's own shielded state. Hairline borders, layered shadows for real
 * depth (not blur), a fine grain overlay, and a strict 8px rhythm. Display
 * type is Space Grotesk with tight tracking; body is Inter; every on-chain
 * value is JetBrains Mono with tabular figures.
 */

// ---- palette tokens ---------------------------------------------------------

const ink = {
  900: '#07060b', // app canvas
  850: '#0b0a12',
  800: '#100e18', // raised surface
  750: '#161320', // hover surface
  700: '#1d1930',
};

const line = {
  faint: 'rgba(255,255,255,0.06)',
  soft: 'rgba(255,255,255,0.09)',
  strong: 'rgba(255,255,255,0.14)',
};

const violet = {
  main: '#8b5cf6',
  light: '#a78bfa',
  dark: '#6d34e8',
  contrastText: '#ffffff',
};

const teal = {
  main: '#2dd4bf',
  light: '#5eead4',
  dark: '#14a89a',
  contrastText: '#03211d',
};

const text = {
  primary: '#f5f3fb',
  secondary: '#9c98b3',
  disabled: '#615c78',
};

export const csTokens = { ink, line, violet, teal, text };

// ---- shared style fragments ----------------------------------------------------

const cardShadow = '0 1px 2px rgba(0,0,0,0.5), 0 10px 24px -12px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.03)';
const cardShadowHover =
  '0 2px 6px rgba(0,0,0,0.5), 0 22px 48px -16px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.05)';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: violet,
    secondary: teal,
    success: { main: '#34d399', light: '#6ee7b7', dark: '#059669' },
    warning: { main: '#fbbf24', light: '#fcd34d', dark: '#d97706' },
    error: { main: '#f87171', light: '#fca5a5', dark: '#dc2626' },
    info: { main: '#60a5fa', light: '#93c5fd', dark: '#2563eb' },
    background: { default: ink[900], paper: ink[800] },
    text,
    divider: line.soft,
  },

  shape: { borderRadius: 14 },

  typography: {
    fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    h1: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05 },
    h2: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.08 },
    h3: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.12 },
    h4: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, letterSpacing: '-0.02em' },
    h5: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, letterSpacing: '-0.015em' },
    h6: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, letterSpacing: '-0.01em' },
    subtitle1: { fontWeight: 500 },
    subtitle2: { fontWeight: 600, letterSpacing: '0.01em' },
    body2: { lineHeight: 1.6 },
    button: { fontWeight: 600, letterSpacing: '0.005em', textTransform: 'none' },
    overline: { fontWeight: 700, letterSpacing: '0.22em', fontSize: '0.68rem' },
    caption: { letterSpacing: '0.01em' },
  },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ':root': { colorScheme: 'dark' },

        body: {
          minHeight: '100vh',
          backgroundColor: ink[900],
          color: text.primary,
          backgroundImage: [
            `radial-gradient(1100px 620px at 8% -6%, ${alpha(violet.main, 0.14)}, transparent 60%)`,
            `radial-gradient(900px 560px at 100% 0%, ${alpha(teal.main, 0.08)}, transparent 55%)`,
            `radial-gradient(1200px 800px at 50% 120%, ${alpha(violet.dark, 0.12)}, transparent 60%)`,
          ].join(','),
          backgroundAttachment: 'fixed',
          backgroundRepeat: 'no-repeat',
        },

        // Fine film grain over the whole viewport — kills the "flat gradient" look.
        'body::after': {
          content: '""',
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 2147483000,
          opacity: 0.5,
          mixBlendMode: 'overlay',
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E\")",
        },

        '::selection': { background: alpha(violet.main, 0.4) },

        '*::-webkit-scrollbar': { width: 11, height: 11 },
        '*::-webkit-scrollbar-track': { background: 'transparent' },
        '*::-webkit-scrollbar-thumb': {
          background: alpha(violet.light, 0.2),
          borderRadius: 8,
          border: '3px solid transparent',
          backgroundClip: 'padding-box',
        },
        '*::-webkit-scrollbar-thumb:hover': { background: alpha(violet.light, 0.38), backgroundClip: 'padding-box' },

        // Motion vocabulary
        '@keyframes cs-rise': {
          from: { opacity: 0, transform: 'translateY(14px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        '@keyframes cs-pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } },
        '@keyframes cs-ping': {
          '0%': { transform: 'scale(1)', opacity: 0.5 },
          '80%,100%': { transform: 'scale(2.4)', opacity: 0 },
        },
        '@keyframes cs-drift': {
          '0%': { transform: 'translate3d(0,0,0) scale(1)' },
          '33%': { transform: 'translate3d(3%,-4%,0) scale(1.06)' },
          '66%': { transform: 'translate3d(-2%,3%,0) scale(0.97)' },
          '100%': { transform: 'translate3d(0,0,0) scale(1)' },
        },
        '@keyframes cs-shimmer': {
          '100%': { transform: 'translateX(100%)' },
        },
        '@keyframes cs-sheen': {
          '0%': { transform: 'translateX(-120%) skewX(-18deg)' },
          '60%,100%': { transform: 'translateX(220%) skewX(-18deg)' },
        },
        '@media (prefers-reduced-motion: reduce)': {
          '*': { animationDuration: '0.001ms !important', animationIterationCount: '1 !important' },
        },
      },
    },

    MuiContainer: { styleOverrides: { root: { position: 'relative', zIndex: 1 } } },

    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: ink[800],
          border: `1px solid ${line.faint}`,
          boxShadow: cardShadow,
          backgroundClip: 'padding-box',
        },
      },
    },

    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: alpha(ink[900], 0.66),
          backdropFilter: 'blur(20px) saturate(150%)',
          WebkitBackdropFilter: 'blur(20px) saturate(150%)',
          borderBottom: `1px solid ${line.faint}`,
          boxShadow: 'none',
          color: text.primary,
        },
      },
    },

    MuiButton: {
      defaultProps: { disableElevation: true, disableRipple: false },
      styleOverrides: {
        root: {
          position: 'relative',
          borderRadius: 11,
          paddingInline: 18,
          paddingBlock: 9,
          overflow: 'hidden',
          transition:
            'transform 150ms cubic-bezier(.2,.7,.2,1), box-shadow 150ms ease, background-color 150ms ease, border-color 150ms ease',
          '&:focus-visible': { outline: `2px solid ${alpha(violet.light, 0.7)}`, outlineOffset: 2 },
          '&:active': { transform: 'translateY(1px)' },
          '&.Mui-disabled': { opacity: 0.42 },
        },
        contained: {
          backgroundColor: violet.main,
          boxShadow: `0 1px 0 rgba(255,255,255,0.14) inset, 0 12px 28px -14px ${alpha(violet.main, 0.95)}`,
          '&:hover': {
            backgroundColor: violet.light,
            boxShadow: `0 1px 0 rgba(255,255,255,0.2) inset, 0 16px 36px -14px ${alpha(violet.light, 1)}`,
            transform: 'translateY(-1px)',
          },
          // moving sheen on hover
          '&::after': {
            content: '""',
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: '40%',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent)',
            transform: 'translateX(-120%) skewX(-18deg)',
          },
          '&:hover::after': { animation: 'cs-sheen 900ms ease' },
          '&.MuiButton-colorSecondary': {
            color: teal.contrastText,
            backgroundColor: teal.main,
            boxShadow: `0 1px 0 rgba(255,255,255,0.22) inset, 0 12px 28px -14px ${alpha(teal.main, 0.9)}`,
          },
          '&.MuiButton-colorSecondary:hover': { backgroundColor: teal.light, transform: 'translateY(-1px)' },
          '&.MuiButton-colorWarning': { color: '#241400' },
        },
        outlined: {
          borderColor: line.strong,
          color: text.primary,
          backgroundColor: alpha('#ffffff', 0.015),
          '&:hover': {
            borderColor: alpha(violet.light, 0.7),
            backgroundColor: alpha(violet.main, 0.1),
            transform: 'translateY(-1px)',
          },
        },
        text: { '&:hover': { backgroundColor: alpha(violet.main, 0.1) } },
        sizeSmall: { paddingInline: 13, paddingBlock: 6, fontSize: '0.8rem', borderRadius: 9 },
        sizeLarge: { paddingBlock: 12.5, fontSize: '0.98rem', borderRadius: 12 },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          letterSpacing: '0.01em',
          borderRadius: 8,
          height: 26,
          border: `1px solid ${line.soft}`,
          backgroundColor: alpha('#ffffff', 0.03),
        },
        label: { paddingInline: 10 },
        outlined: { backgroundColor: 'transparent' },
        sizeSmall: { height: 22, fontSize: '0.72rem' },
        icon: { marginLeft: 7 },
      },
    },

    MuiDivider: { styleOverrides: { root: { borderColor: line.faint } } },

    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          backgroundColor: alpha(ink[900], 0.55),
          transition: 'border-color 140ms ease, box-shadow 140ms ease',
          '& .MuiOutlinedInput-notchedOutline': { borderColor: line.soft },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: alpha(violet.light, 0.55) },
          '&.Mui-focused': { boxShadow: `0 0 0 3px ${alpha(violet.main, 0.22)}` },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: violet.main, borderWidth: 1 },
        },
        input: { fontFamily: "'Inter', sans-serif", '&::placeholder': { color: text.disabled, opacity: 1 } },
      },
    },
    MuiInputLabel: { styleOverrides: { root: { '&.Mui-focused': { color: violet.light } } } },

    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 11,
          border: `1px solid ${line.soft}`,
          alignItems: 'center',
          backgroundColor: ink[750],
        },
        icon: { opacity: 0.9 },
        message: { fontSize: '0.86rem' },
      },
    },

    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: ink[700],
          border: `1px solid ${line.strong}`,
          fontSize: '0.74rem',
          fontWeight: 500,
          padding: '6px 10px',
          borderRadius: 8,
          boxShadow: cardShadow,
        },
        arrow: { color: ink[700] },
      },
    },

    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 999, backgroundColor: alpha(violet.light, 0.12), height: 3 },
        bar: { borderRadius: 999, background: `linear-gradient(90deg, ${violet.main}, ${teal.main})` },
      },
    },

    MuiSkeleton: {
      styleOverrides: {
        root: { backgroundColor: alpha('#ffffff', 0.05), borderRadius: 8 },
      },
    },

    MuiSnackbarContent: { styleOverrides: { root: { borderRadius: 11 } } },
  },
});

// re-export for consumers that want the raw hover shadow
export const csCardHoverShadow = cardShadowHover;
