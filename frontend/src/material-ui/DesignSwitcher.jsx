// Lets the user flip between the original UI and the isolated Material UI preview.
// The original App is the default; the Material UI code is lazy-loaded so it costs nothing
// until it is selected. The choice is remembered in localStorage.
import { lazy, Suspense, useEffect, useState } from 'react';

const MaterialApp = lazy(() => import('./MaterialApp.jsx'));

const STORAGE_KEY = 'tms-ui-design';
const DESIGNS = [
  { key: 'original', label: 'Original UI' },
  { key: 'material', label: 'Material UI' },
];

function readDesign() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'material' ? 'material' : 'original';
  } catch {
    return 'original';
  }
}

const barStyle = {
  position: 'fixed',
  top: 8,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 2000,
  display: 'flex',
  padding: 4,
  gap: 4,
  background: '#ffffff',
  border: '1px solid #9aa5b1',
  borderRadius: 999,
  boxShadow: '0 2px 10px rgba(31, 41, 51, 0.3)',
  font: '600 13px/1 "Segoe UI", Roboto, Arial, sans-serif',
  whiteSpace: 'nowrap',
};

const buttonStyle = (active) => ({
  border: 0,
  cursor: 'pointer',
  padding: '8px 16px',
  minHeight: 32,
  borderRadius: 999,
  font: 'inherit',
  color: active ? '#ffffff' : '#323f4b',
  background: active ? '#1565c0' : 'transparent',
});

export default function DesignSwitcher({ children }) {
  const [design, setDesign] = useState(readDesign);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, design);
    } catch {
      // Storage unavailable: the switch still works for this page view.
    }
  }, [design]);

  return (
    <>
      <div role="group" aria-label="Choose interface design" style={barStyle}>
        {DESIGNS.map(({ key, label }) => (
          <button key={key} type="button" aria-pressed={design === key} style={buttonStyle(design === key)} onClick={() => setDesign(key)}>
            {label}
          </button>
        ))}
      </div>
      {design === 'material' ? (
        <Suspense fallback={null}>
          <MaterialApp />
        </Suspense>
      ) : (
        children
      )}
    </>
  );
}
