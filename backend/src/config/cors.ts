/**
 * Allowed CORS origins for browser and Capacitor native shells.
 */
export function getCorsOrigin():
  | string
  | string[]
  | ((origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void) {
  const configured = process.env.FRONTEND_URL?.trim();
  const extra = (process.env.CORS_EXTRA_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const allowList = new Set<string>([
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    // Production site (browser sends Origin when /api is proxied by nginx)
    'https://megamtx.joelhalen.net',
    'http://megamtx.joelhalen.net',
    // Capacitor Android/iOS WebView origins
    'capacitor://localhost',
    'https://localhost',
    'http://localhost',
    ...extra,
  ]);

  if (configured) allowList.add(configured);

  // Also allow the configured URL with the alternate scheme (http vs https).
  if (configured?.startsWith('https://')) {
    allowList.add(configured.replace(/^https:/, 'http:'));
  } else if (configured?.startsWith('http://')) {
    allowList.add(configured.replace(/^http:/, 'https:'));
  }

  return (origin, callback) => {
    // Native apps and same-origin requests may omit Origin
    if (!origin || allowList.has(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`CORS blocked origin: ${origin}`));
  };
}
