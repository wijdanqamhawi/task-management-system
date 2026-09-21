// T005 / T010 — Vite is a BUILD TOOL ONLY. It ships no runtime code; the deployed
// frontend is plain HTML, CSS and JavaScript (Constitution II, plan.md Complexity Tracking).
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    proxy: {
      // T010 — forward /api to the backend in development, preserving the session
      // cookie so the same-origin session of R-002 works locally.
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: false,
        secure: false,
      },
    },
  },

  build: {
    // T148 (Phase 12) points this at backend/src/main/resources/static so one artifact
    // is deployed and the API shares an origin with the UI (R-012).
    outDir: 'dist',
    emptyOutDir: true,
  },
});
