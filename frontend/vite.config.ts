import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Capacitor native builds load from the filesystem (file://), so the base
  // must be relative. The dev server and standard web builds use '/'.
  base: process.env.CAPACITOR_BUILD === 'true' ? './' : '/',
  server: {
    port: 5173,
    host: true,
    allowedHosts: ['megamtx.joelhalen.net', 'localhost'],
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Generate source maps for production debugging on mobile crash reporters.
    sourcemap: false,
  },
});
