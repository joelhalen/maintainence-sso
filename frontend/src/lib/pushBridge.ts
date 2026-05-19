/**
 * Push notification bridge.
 *
 * On native (iOS/Android via Capacitor) this uses the @capacitor/push-notifications
 * plugin. On web it falls back to the browser Notification API (no FCM token required
 * for simple permission checks; full web push requires a VAPID service worker which is
 * set up separately).
 */

export type PushPlatform = 'IOS' | 'ANDROID' | 'WEB';

export interface DeviceRegistration {
  token: string;
  platform: PushPlatform;
}

// Lazily import Capacitor so the web bundle never hard-errors if native deps are missing.
async function getCapacitor() {
  try {
    const { Capacitor } = await import('@capacitor/core');
    return Capacitor;
  } catch {
    return null;
  }
}

async function getNativePlugin() {
  const Capacitor = await getCapacitor();
  if (!Capacitor?.isNativePlatform()) return null;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    return { Capacitor, PushNotifications };
  } catch {
    return null;
  }
}

/**
 * Request push notification permission and return the device token.
 * Returns null if the user denies permission or the platform is unsupported.
 */
export async function requestPushPermission(): Promise<DeviceRegistration | null> {
  const native = await getNativePlugin();
  if (!native) {
    // Web fallback: browser Notification API
    if ('Notification' in window) {
      const result = await Notification.requestPermission();
      if (result !== 'granted') return null;
    }
    return null;
  }

  const { Capacitor, PushNotifications } = native;
  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') return null;

  return new Promise((resolve) => {
    PushNotifications.addListener('registration', (event: { value: string }) => {
      resolve({
        token: event.value,
        platform: Capacitor.getPlatform().toUpperCase() as PushPlatform,
      });
    });

    PushNotifications.addListener('registrationError', () => resolve(null));

    PushNotifications.register();
  });
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
export async function isNativeApp(): Promise<boolean> {
  const Capacitor = await getCapacitor();
  return Capacitor?.isNativePlatform() ?? false;
}
