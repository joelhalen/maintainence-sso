import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const isCapacitorBuild =
  process.env.CAPACITOR_BUILD === 'true' || process.env.VITE_CAPACITOR_BUILD === 'true';

export default defineConfig({
  plugins: [react()],
  // Capacitor native builds load from the filesystem; web builds use absolute '/'.
  base: isCapacitorBuild ? './' : '/',
  define: {
    'import.meta.env.VITE_CAPACITOR_BUILD': JSON.stringify(isCapacitorBuild ? 'true' : ''),
  },
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
