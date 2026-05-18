import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.megamtx.maintenance',
  appName: 'MegaMTX',
  webDir: 'dist',
  server: {
    // Use https scheme on Android for secure cookie/JWT storage
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
