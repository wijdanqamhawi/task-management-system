// Entry point for the isolated Material UI preview (served from /material-ui.html).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import MaterialApp from './MaterialApp.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MaterialApp />
  </StrictMode>,
);
