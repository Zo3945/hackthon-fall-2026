import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// the Blue CoLab API blocks browser calls, so we pass /api through the dev server
const api = {
  '/api': { target: 'https://colabprod01.pace.edu', changeOrigin: true },
};

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true, proxy: api },
  preview: { port: 5173, strictPort: true, proxy: api },
});
