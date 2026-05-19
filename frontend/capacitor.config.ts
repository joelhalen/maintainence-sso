import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.megamtx.maintenance',
  appName: 'MegaMTX',
  webDir: 'dist',
  server: {
    // Bundled assets only — API calls use VITE_API_URL (see src/api/client.ts).
    // Do not set `url` here; that would turn the app into a remote WebView.
    androidScheme: 'https',
  },
  plugins: {
    PushNotifications: {
      // Show notification UI even when app is in foreground
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    StatusBar: {
      // Match the dark sidebar color
      backgroundColor: '#111827',
      style: 'DARK',
    },
  },
};

export default config;
