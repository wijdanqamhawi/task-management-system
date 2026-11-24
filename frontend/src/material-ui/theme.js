import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    primary: { main: '#1565c0', light: '#e3f0fc', dark: '#0d47a1' },
    background: { default: '#f4f6f8', paper: '#ffffff' },
    text: { primary: '#1f2933', secondary: '#637381' },
    divider: '#e4e8ec',
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: '"Roboto", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    h4: { fontWeight: 700, fontSize: '1.75rem' },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          border: '1px solid #e4e8ec',
          boxShadow: '0 2px 8px rgba(31, 41, 51, 0.06)',
        },
      },
    },
    MuiPaper: { styleOverrides: { rounded: { borderRadius: 12 } } },
    MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { borderRadius: 10 } } },
    MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
    MuiTableCell: { styleOverrides: { head: { fontWeight: 700, color: '#637381', backgroundColor: '#f9fafb' } } },
  },
});
