import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider, CssBaseline } from '@mui/material';
import App from './App';
import './index.css';

// Import custom theme for responsive design
import { theme } from './theme';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* 
      ThemeProvider: Applies the custom MUI theme with responsive breakpoints
      CssBaseline: Normalizes CSS and provides consistent base styles across browsers
    */}
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
