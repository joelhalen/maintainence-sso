import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Check,
  Download,
  Hammer,
  RefreshCw,
  Save,
  Smartphone,
} from 'lucide-react';
import api from '../api/client';

interface MobileReleaseConfig {
  versionName: string;
  versionCode: number;
  minVersionCode: number;
  apkUrl: string;
  playStoreUrl: string | null;
  appStoreUrl: string | null;
}

interface MobileBuildState {
  status: 'idle' | 'running' | 'succeeded' | 'failed';
  startedAt: string | null;
  finishedAt: string | null;
  log: string;
  error: string | null;
}

interface MobileReleaseAdminView {
  config: MobileReleaseConfig;
  release: MobileReleaseConfig & { builtAt?: string; sha256?: string; bytes?: number };
  build: MobileBuildState;
  downloadPageUrl: string;
  canBuild: boolean;
  buildUnavailableReason: string | null;
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PlatformMobileReleasePage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<MobileReleaseConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<MobileReleaseAdminView>({
    queryKey: ['platform-mobile-release'],
    queryFn: () => api.get('/platform/mobile-release').then((r) => r.data),
    refetchInterval: (q) => (q.state.data?.build.status === 'running' ? 3000 : false),
  });

  useEffect(() => {
    if (data?.config) setForm(data.config);
  }, [data?.config]);

  const saveConfig = async () => {
    if (!form) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await api.patch('/platform/mobile-release', {
        ...form,
        versionCode: Number(form.versionCode),
        minVersionCode: Number(form.minVersionCode),
        playStoreUrl: form.playStoreUrl?.trim() || null,
        appStoreUrl: form.appStoreUrl?.trim() || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      qc.invalidateQueries({ queryKey: ['platform-mobile-release'] });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to save release settings');
    } finally {
      setSaving(false);
    }
  };

  const startBuild = async () => {
    setBuilding(true);
    setError('');
    try {
      await api.post('/platform/mobile-release/build');
      qc.invalidateQueries({ queryKey: ['platform-mobile-release'] });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to start APK build');
    } finally {
      setBuilding(false);
    }
  };

  if (isLoading || !form) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3" />
        <div className="h-48 bg-white rounded-xl border border-gray-200" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
        <AlertCircle size={14} /> Failed to load mobile release settings.
      </div>
    );
  }

  const build = data!.build;
  const release = data!.release;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <Smartphone size={22} className="text-violet-600" />
          Mobile app release
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Control version requirements for installed Android apps and build a new APK from this dashboard.
          Changes apply immediately to in-app update checks without editing code.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-5">
        <h2 className="text-sm font-semibold text-gray-900">Version policy</h2>
        <p className="text-xs text-gray-500 -mt-3">
          Devices compare their installed <span className="font-medium">version code</span> against these values on every launch.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Version name</label>
            <input
              value={form.versionName}
              onChange={(e) => setForm((f) => f && ({ ...f, versionName: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="1.2.0"
            />
            <p className="text-xs text-gray-400 mt-1">Display label (e.g. 1.2.0)</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Current version code</label>
            <input
              type="number"
              min={1}
              value={form.versionCode}
              onChange={(e) => setForm((f) => f && ({ ...f, versionCode: parseInt(e.target.value, 10) || 1 }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">Latest published build number</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Minimum version code</label>
            <input
              type="number"
              min={1}
              value={form.minVersionCode}
              onChange={(e) => setForm((f) => f && ({ ...f, minVersionCode: parseInt(e.target.value, 10) || 1 }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">Force update below this code</p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">APK download URL</label>
          <input
            value={form.apkUrl}
            onChange={(e) => setForm((f) => f && ({ ...f, apkUrl: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Play Store URL (optional)</label>
            <input
              value={form.playStoreUrl ?? ''}
              onChange={(e) => setForm((f) => f && ({ ...f, playStoreUrl: e.target.value || null }))}
              placeholder="https://play.google.com/store/apps/details?id=…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">App Store URL (optional)</label>
            <input
              value={form.appStoreUrl ?? ''}
              onChange={(e) => setForm((f) => f && ({ ...f, appStoreUrl: e.target.value || null }))}
              placeholder="https://apps.apple.com/app/id…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={saveConfig}
            disabled={saving || build.status === 'running'}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? 'Saving…' : 'Save version settings'}
          </button>
          {saved && (
            <span className="inline-flex items-center gap-1 text-sm text-green-600">
              <Check size={14} /> Saved — live for all apps now
            </span>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Published artifact</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-gray-500 text-xs">Last built</dt>
            <dd className="font-medium text-gray-900">{release.builtAt ? new Date(release.builtAt).toLocaleString() : '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-500 text-xs">APK size</dt>
            <dd className="font-medium text-gray-900">{formatBytes(release.bytes)}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-gray-500 text-xs">SHA-256</dt>
            <dd className="font-mono text-xs text-gray-700 break-all">{release.sha256 ?? '—'}</dd>
          </div>
        </dl>
        <a
          href={data!.downloadPageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          <Download size={14} />
          Open public download page
        </a>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Build new APK</h2>
            <p className="text-xs text-gray-500 mt-1">
              Compiles the current web app into an Android package using the version settings above.
              Save settings first, then build. This may take several minutes.
            </p>
          </div>
          {build.status === 'running' && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">
              <RefreshCw size={12} className="animate-spin" /> Building…
            </span>
          )}
          {build.status === 'succeeded' && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
              <Check size={12} /> Last build OK
            </span>
          )}
          {build.status === 'failed' && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 bg-red-50 px-2.5 py-1 rounded-full">
              <AlertCircle size={12} /> Last build failed
            </span>
          )}
        </div>

        {!data!.canBuild && data!.buildUnavailableReason && build.status !== 'running' && (
          <div className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            {data!.buildUnavailableReason}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={startBuild}
            disabled={!data!.canBuild || building || build.status === 'running'}
            className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50"
          >
            <Hammer size={14} />
            {build.status === 'running' ? 'Build in progress…' : 'Build & publish APK'}
          </button>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
          >
            <RefreshCw size={14} />
            Refresh status
          </button>
        </div>

        {build.log && (
          <pre className="text-xs bg-gray-900 text-gray-100 rounded-lg p-4 overflow-auto max-h-64 font-mono whitespace-pre-wrap">
            {build.log}
          </pre>
        )}
        {build.error && (
          <p className="text-xs text-red-600">{build.error}</p>
        )}
      </div>

      <p className="text-xs text-gray-400">
        Tip: increment <span className="font-medium">current version code</span> before each build so existing installs receive an update prompt.
        Raise <span className="font-medium">minimum version code</span> to force older clients to update.
      </p>
    </div>
  );
}
