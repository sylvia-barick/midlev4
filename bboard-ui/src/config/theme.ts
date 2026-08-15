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
      paper: 'rgba(25, 25, 35, 0.92)',
    },
    text: {
      primary: '#ffffff',
      secondary: '#b8b8c8',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundImage: 'url("/back.jpg")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed',
          minHeight: '100vh',
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }
      }
    }
  },
  typography: {
    fontFamily: 'Helvetica, Arial, sans-serif',
  },
});
