import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The Blue CoLab API does not allow direct calls from a browser,
// so the dev server passes /api/* through to it.
const api = {
  '/api': { target: 'https://colabprod01.pace.edu', changeOrigin: true },
};

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true, proxy: api },
  preview: { port: 5173, strictPort: true, proxy: api },
});
