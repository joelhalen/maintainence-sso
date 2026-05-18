import { App, cert, initializeApp, getApps } from 'firebase-admin/app';
import { logger } from './logger';

let app: App | null = null;

export function isFcmConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL)
  );
}

export function getFcmApp(): App | null {
  if (!isFcmConfigured()) return null;
  if (app) return app;

  const existing = getApps();
  if (existing.length > 0) {
    app = existing[0];
    return app;
  }

  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      app = initializeApp({ credential: cert(sa) });
    } else {
      app = initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID!,
          privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        }),
      });
    }
    logger.info('Firebase Admin SDK initialized');
  } catch (err) {
    logger.error('Firebase Admin SDK initialization failed', { err });
    return null;
  }

  return app;
}

export function getFcmConfigStatus() {
  return {
    configured: isFcmConfigured(),
    hasProjectId: Boolean(process.env.FIREBASE_PROJECT_ID),
    hasPrivateKey: Boolean(process.env.FIREBASE_PRIVATE_KEY),
    hasClientEmail: Boolean(process.env.FIREBASE_CLIENT_EMAIL),
    hasServiceAccountJson: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
    projectId: process.env.FIREBASE_PROJECT_ID || '',
  };
}
