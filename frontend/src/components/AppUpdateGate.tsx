import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Download, RefreshCw } from 'lucide-react';
import { ApkInstaller } from '../plugins/apkInstaller';
import {
  clearUpdateSnooze,
  fetchReleaseInfo,
  getInstalledAppInfo,
  getUpdateRequirement,
  isOptionalUpdateSnoozed,
  snoozeOptionalUpdate,
  type AppReleaseInfo,
  type InstalledAppInfo,
  type UpdateRequirement,
} from '../lib/appUpdate';

type GateState = 'idle' | 'checking' | 'ok' | 'update';

export default function AppUpdateGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GateState>(Capacitor.isNativePlatform() ? 'checking' : 'ok');
  const [installed, setInstalled] = useState<InstalledAppInfo | null>(null);
  const [release, setRelease] = useState<AppReleaseInfo | null>(null);
  const [requirement, setRequirement] = useState<UpdateRequirement>('none');
  const [progress, setProgress] = useState(0);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const autoUpdateStarted = useRef(false);

  const runCheck = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      setState('ok');
      return;
    }
    setState('checking');
    setError('');
    try {
      const [local, remote] = await Promise.all([getInstalledAppInfo(), fetchReleaseInfo()]);
      if (!local) {
        setState('ok');
        return;
      }
      setInstalled(local);
      setRelease(remote);
      const req = getUpdateRequirement(local, remote);
      if (req === 'none') {
        setState('ok');
        return;
      }
      if (req === 'optional' && isOptionalUpdateSnoozed()) {
        setState('ok');
        return;
      }
      setRequirement(req);
      setState('update');
    } catch {
      setState('ok');
    }
  }, []);

  useEffect(() => {
    runCheck();
  }, [runCheck]);

  const startUpdate = useCallback(async () => {
    if (!release) return;
    setUpdating(true);
    setError('');
    setProgress(0);
    clearUpdateSnooze();

    const listener = await ApkInstaller.addListener('progress', (e) => {
      setProgress(e.percent);
    });

    try {
      await ApkInstaller.downloadAndInstall({ url: release.apkUrl });
    } catch (err: unknown) {
      const message =
        (err as { message?: string })?.message
        ?? (err instanceof Error ? err.message : 'Update failed');
      if (message.includes('UNKNOWN_SOURCES') || message.includes('Allow installs')) {
        setError('Enable “Install unknown apps” for MegaMTX in Settings, then tap Update again.');
      } else {
        setError(message || 'Could not download the update. Check your connection and try again.');
      }
    } finally {
      await listener.remove();
      setUpdating(false);
    }
  }, [release]);

  useEffect(() => {
    if (state === 'update' && release && !autoUpdateStarted.current) {
      autoUpdateStarted.current = true;
      void startUpdate();
    }
  }, [state, release, startUpdate]);

  const handleLater = () => {
    if (requirement === 'required') return;
    snoozeOptionalUpdate();
    setState('ok');
  };

  if (state === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-gray-300 text-sm">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        Checking for updates…
      </div>
    );
  }

  if (state === 'update' && release && installed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-6 space-y-5">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 mb-3">
              <Download className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-lg font-semibold text-gray-900">Update available</h1>
            <p className="text-sm text-gray-500 mt-1">
              {requirement === 'required'
                ? 'This version is required to continue using MegaMTX.'
                : 'A newer version is ready to install.'}
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">Installed</span>
              <span className="font-medium text-gray-800">
                {installed.versionName} ({installed.versionCode})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Latest</span>
              <span className="font-medium text-gray-800">
                {release.versionName} ({release.versionCode})
              </span>
            </div>
          </div>

          {updating && (
            <div className="space-y-2">
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${Math.max(progress, 5)}%` }}
                />
              </div>
              <p className="text-xs text-center text-gray-500">
                {progress < 100 ? `Downloading… ${progress}%` : 'Opening installer…'}
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={startUpdate}
              disabled={updating}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
            >
              {updating ? 'Updating…' : 'Update now'}
            </button>
            {requirement !== 'required' && (
              <button
                type="button"
                onClick={handleLater}
                disabled={updating}
                className="w-full py-2.5 text-gray-600 text-sm hover:text-gray-900"
              >
                Remind me later
              </button>
            )}
            <button
              type="button"
              onClick={runCheck}
              disabled={updating}
              className="w-full py-2 text-gray-400 text-xs hover:text-gray-600"
            >
              Check again
            </button>
          </div>

          <p className="text-xs text-gray-400 text-center">
            Android will ask you to confirm the install. Tap Update to download and open the installer automatically.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
