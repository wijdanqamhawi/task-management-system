// T005 / T042 — React entry point.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import DesignSwitcher from './material-ui/DesignSwitcher.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <DesignSwitcher>
      <App />
    </DesignSwitcher>
  </StrictMode>,
);
