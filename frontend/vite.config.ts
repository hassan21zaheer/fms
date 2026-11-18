import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(({command}) => ({
  // Built files are served by Laravel from public/app, so assets load from /app/ in production.
  base: command === 'build' ? '/app/' : '/',
  build: {
    outDir: path.resolve(__dirname, '../backend/public/app'),
    emptyOutDir: true,
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    // The browser talks to this dev server only; /api and /storage are forwarded to the Laravel backend.
    proxy: {
      '/api': {target: 'http://127.0.0.1:8000', changeOrigin: true},
      '/storage': {target: 'http://127.0.0.1:8000', changeOrigin: true},
    },
  },
}));
