import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const server = 'http://localhost:3001';

export default defineConfig({
  root: 'client',
  plugins: [react()],
  build: {
    outDir: '../dist/client',
    emptyOutDir: true,
  },
  server: {
    // Reachable from a phone on the same Wi-Fi.
    host: true,
    proxy: {
      '/api': server,
      '/socket.io': { target: server, ws: true },
    },
  },
});
