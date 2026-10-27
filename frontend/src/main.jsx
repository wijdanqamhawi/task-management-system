// T005 / T042 — React entry point.
// The providers sit above the design switcher, so the session, router and unread count are one
// instance whichever design is shown; switching only changes the presentation.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Providers, Shell } from './App.jsx';
import DesignSwitcher from './material-ui/DesignSwitcher.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Providers>
      <DesignSwitcher>
        <Shell />
      </DesignSwitcher>
    </Providers>
  </StrictMode>,
);
