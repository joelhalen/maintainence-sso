/**
 * Push notification bridge.
 *
 * On native (iOS/Android via Capacitor) this uses the @capacitor/push-notifications
 * plugin. On web it falls back to the browser Notification API (no FCM token required
 * for simple permission checks; full web push requires a VAPID service worker which is
 * set up separately).
 */

import { Capacitor } from '@capacitor/core';

// Lazily import the native plugin so the web bundle never hard-errors if the
// Capacitor plugin isn't installed (it won't be present on plain web builds).
async function getNativePlugin() {
  if (!Capacitor.isNativePlatform()) return null;
  const { PushNotifications } = await import('@capacitor/push-notifications');
  return PushNotifications;
}

export type PushPlatform = 'IOS' | 'ANDROID' | 'WEB';

export interface DeviceRegistration {
  token: string;
  platform: PushPlatform;
}

/**
 * Request push notification permission and return the device token.
 * Returns null if the user denies permission or the platform is unsupported.
 */
export async function requestPushPermission(): Promise<DeviceRegistration | null> {
  const plugin = await getNativePlugin();

  if (plugin) {
    const permission = await plugin.requestPermissions();
    if (permission.receive !== 'granted') return null;

    return new Promise((resolve) => {
      plugin.addListener('registration', (event) => {
        resolve({
          token: event.value,
          platform: Capacitor.getPlatform().toUpperCase() as PushPlatform,
        });
      });

      plugin.addListener('registrationError', () => resolve(null));

      plugin.register();
    });
  }

  // Web fallback: browser Notification API
  if ('Notification' in window) {
    const result = await Notification.requestPermission();
    if (result !== 'granted') return null;
    // Full web push requires a service worker + VAPID subscription — signal that
    // browser push is available but the token will be obtained via SW registration.
    return null;
  }

  return null;
}

/**
 * Register a device token with the MegaMTX backend.
 * Should be called once after sign-in when running in a native context.
 */
export async function registerDeviceWithBackend(
  apiClient: { post: (url: string, data: unknown) => Promise<unknown> }
): Promise<void> {
  const registration = await requestPushPermission();
  if (!registration) return;

  try {
    await apiClient.post('/devices', {
      token: registration.token,
      platform: registration.platform,
    });
  } catch {
    // Non-fatal — push registration failure should never block app startup.
  }
}

/**
 * Returns true when the current runtime is a Capacitor-wrapped native app.
 */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}
