import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electronMockPlugin from './electron-mock-plugin.js';

export default defineConfig({
  base: './',
  plugins: [react(), electronMockPlugin()],
  server: {
    host: '127.0.0.1',
    port: 5180,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
