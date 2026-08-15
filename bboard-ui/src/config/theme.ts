import { createTheme } from '@mui/material';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#ab47bc',
      light: '#df78ef',
      dark: '#790e8b',
    },
    secondary: {
      main: '#4caf50',
    },
    background: {
      default: '#121218',
      paper: '#1e1e28',
    },
    text: {
      primary: '#ffffff',
      secondary: '#a0a0b0',
    },
  },
  typography: {
    fontFamily: 'Helvetica, Arial, sans-serif',
  },
});
