/**
 * MUI Theme Configuration for Responsive Design
 * 
 * This theme file defines breakpoints and component styles that adapt
 * the application to different screen sizes:
 * - xs: 0-599px (Mobile)
 * - sm: 600-899px (Tablet Portrait)
 * - md: 900-1199px (Tablet Landscape/Small Laptop)
 * - lg: 1200-1535px (Desktop)
 * - xl: 1536px+ (Large Desktop)
 */

import { createTheme } from '@mui/material/styles';

// Create the theme with custom breakpoints and styles
export const theme = createTheme({
  // ===========================================================================
  // Responsive Breakpoints
  // ===========================================================================
  // These values define the screen size thresholds for responsive behavior
  breakpoints: {
    values: {
      xs: 0,       // Mobile phones (< 600px)
      sm: 600,     // Tablet portrait (600px - 899px)
      md: 900,     // Tablet landscape (900px - 1199px)
      lg: 1200,    // Desktop (1200px - 1535px)
      xl: 1536,    // Large desktop (> 1536px)
    },
  },

  // ===========================================================================
  // Typography
  // ===========================================================================
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    // Make h6 and body text slightly smaller on mobile for better fit
    h6: {
      fontSize: '1rem',
      '@media (min-width:600px)': {
        fontSize: '1.125rem',
      },
    },
    body1: {
      fontSize: '0.875rem',
      '@media (min-width:600px)': {
        fontSize: '1rem',
      },
    },
    body2: {
      fontSize: '0.8125rem',
      '@media (min-width:600px)': {
        fontSize: '0.875rem',
      },
    },
  },

  // ===========================================================================
  // Component Style Overrides
  // ===========================================================================
  components: {
    // -------------------------------------------------------------------------
    // Button Styles - Better touch targets and no uppercase transform
    // -------------------------------------------------------------------------
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none', // Better for mobile, less aggressive styling
          borderRadius: 8,
          padding: '8px 16px',
          // Ensure minimum touch target size (44px) for mobile
          minHeight: 44,
          fontSize: '0.875rem',
          '@media (min-width:600px)': {
            fontSize: '1rem',
          },
        },
        // Smaller buttons for compact mobile view
        sizeSmall: {
          padding: '6px 12px',
          fontSize: '0.8125rem',
        },
      },
    },

    // -------------------------------------------------------------------------
    // TextField Styles - Responsive padding
    // -------------------------------------------------------------------------
    MuiTextField: {
      styleOverrides: {
        root: {
          // Full width on mobile for easier touch input
          width: '100%',
        },
      },
    },

    // -------------------------------------------------------------------------
    // Table Styles - Responsive cell padding
    // -------------------------------------------------------------------------
    MuiTableCell: {
      styleOverrides: {
        root: {
          padding: '8px', // Smaller padding for mobile
          fontSize: '0.8125rem',
          '@media (min-width:600px)': {
            padding: '12px 16px', // More padding on larger screens
            fontSize: '0.875rem',
          },
        },
        head: {
          fontWeight: 600,
          backgroundColor: '#f5f5f5',
        },
      },
    },

    // -------------------------------------------------------------------------
    // Card Styles - Responsive
    // -------------------------------------------------------------------------
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          // Add subtle shadow for depth
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          '@media (min-width:600px)': {
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // Dialog Styles - Full screen on mobile
    // -------------------------------------------------------------------------
    MuiDialog: {
      styleOverrides: {
        paper: {
          // Full screen dialogs on mobile for better UX
          margin: 16,
          '@media (min-width:600px)': {
            margin: 32,
            maxWidth: 600,
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // Chip Styles - Smaller on mobile
    // -------------------------------------------------------------------------
    MuiChip: {
      styleOverrides: {
        root: {
          fontSize: '0.75rem',
          height: 24,
          '@media (min-width:600px)': {
            fontSize: '0.8125rem',
            height: 28,
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // Form Control Styles
    // -------------------------------------------------------------------------
    MuiFormControl: {
      styleOverrides: {
        root: {
          marginBottom: 8,
          '@media (min-width:600px)': {
            marginBottom: 16,
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // AppBar Styles
    // -------------------------------------------------------------------------
    MuiAppBar: {
      styleOverrides: {
        root: {
          // Ensure AppBar works well on mobile
          padding: '0 8px',
          '@media (min-width:600px)': {
            padding: '0 16px',
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // Icon Button - Minimum touch target
    // -------------------------------------------------------------------------
    MuiIconButton: {
      styleOverrides: {
        root: {
          // Ensure minimum 44px touch target for mobile accessibility
          padding: 8,
          '@media (min-width:600px)': {
            padding: 12,
          },
        },
      },
    },
  },

  // ===========================================================================
  // Palette
  // ===========================================================================
  palette: {
    primary: {
      main: '#667eea',
      light: '#8fa0f5',
      dark: '#4f5dc9',
    },
    secondary: {
      main: '#764ba2',
      light: '#9a72c2',
      dark: '#5a3a7e',
    },
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
    },
  },

  // ===========================================================================
  // Shape
  // ===========================================================================
  shape: {
    borderRadius: 8,
  },
});
