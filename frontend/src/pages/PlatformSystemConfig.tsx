import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Save, Check, AlertCircle, AlertTriangle, FileText, Settings2, ToggleLeft, ToggleRight } from 'lucide-react';
import api from '../api/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SystemConfig {
  tos: string;
  privacyPolicy: string;
  maintenanceMode: boolean;
  platformName: string;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'general' | 'tos' | 'privacy';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'general', label: 'General Settings', icon: Settings2 },
  { id: 'tos', label: 'Terms of Service', icon: FileText },
  { id: 'privacy', label: 'Privacy Policy', icon: FileText },
];

export default function PlatformSystemConfigPage() {
  const [tab, setTab] = useState<Tab>('general');
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [localTos, setLocalTos] = useState('');
  const [localPrivacy, setLocalPrivacy] = useState('');
  const [localPlatformName, setLocalPlatformName] = useState('');
  const [localMaintenanceMode, setLocalMaintenanceMode] = useState(false);
  const [previewTos, setPreviewTos] = useState(false);
  const [previewPrivacy, setPreviewPrivacy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedField, setSavedField] = useState<string | null>(null);
  const [error, setError] = useState('');

  const { data, isLoading, isError } = useQuery<SystemConfig>({
    queryKey: ['platform-system-config'],
    queryFn: () => api.get('/platform/system-config').then((r) => r.data),
  });

  // Sync remote data into local state once loaded
  useEffect(() => {
    if (data) {
      setConfig(data);
      setLocalTos(data.tos ?? '');
      setLocalPrivacy(data.privacyPolicy ?? '');
      setLocalPlatformName(data.platformName ?? '');
      setLocalMaintenanceMode(data.maintenanceMode ?? false);
    }
  }, [data]);

  const save = async (fields: Partial<SystemConfig>) => {
    setSaving(true);
    setError('');
    try {
      const { data: updated } = await api.patch<SystemConfig>('/platform/system-config', fields);
      setConfig(updated);
      setSavedField(Object.keys(fields)[0] ?? null);
      setTimeout(() => setSavedField(null), 2000);
    } catch {
      setError('Failed to save. Please try again.');
      setTimeout(() => setError(''), 4000);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3" />
        <div className="h-4 bg-gray-100 rounded w-1/2" />
        <div className="h-64 bg-white rounded-xl border border-gray-200" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
        <AlertCircle size={14} /> Failed to load system configuration.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">System Configuration</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage platform-wide settings, legal documents, and operational controls.
        </p>
      </div>

      {/* Global error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-0.5 bg-gray-100 rounded-lg p-1 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${
              tab === id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: General Settings ─────────────────────────────────────── */}
      {tab === 'general' && (
        <div className="space-y-5">
          {/* Maintenance mode warning banner */}
          {localMaintenanceMode && (
            <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
              <AlertTriangle size={16} className="text-orange-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-orange-800">Maintenance Mode is Enabled</p>
                <p className="text-xs text-orange-700 mt-0.5">
                  This setting is informational only and does not affect access. Use it to coordinate downtime.
                </p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-6">
            {/* Platform name */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">Platform Name</label>
              <p className="text-xs text-gray-500">The name displayed across the platform UI.</p>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={localPlatformName}
                  onChange={(e) => setLocalPlatformName(e.target.value)}
                  className="flex-1 max-w-sm border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="My Platform"
                />
                <button
                  onClick={() => save({ platformName: localPlatformName })}
                  disabled={saving || !localPlatformName.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors"
                >
                  <Save size={13} />
                  Save
                </button>
                {savedField === 'platformName' && (
                  <SavedIndicator />
                )}
              </div>
            </div>

            <div className="border-t border-gray-100" />

            {/* Maintenance mode */}
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700">Maintenance Mode</label>
                  <p className="text-xs text-gray-500 mt-0.5">
                    When enabled, this setting is informational only and does not affect access.
                    Use it to coordinate downtime with your team.
                  </p>
                </div>
                <button
                  onClick={() => {
                    const next = !localMaintenanceMode;
                    setLocalMaintenanceMode(next);
                  }}
                  className="flex-shrink-0 text-gray-400 hover:text-gray-700 transition-colors"
                  aria-label="Toggle maintenance mode"
                >
                  {localMaintenanceMode ? (
                    <ToggleRight size={32} className="text-orange-500" />
                  ) : (
                    <ToggleLeft size={32} />
                  )}
                </button>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => save({ maintenanceMode: localMaintenanceMode })}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors"
                >
                  <Save size={13} />
                  Save
                </button>
                {savedField === 'maintenanceMode' && (
                  <SavedIndicator />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Terms of Service ─────────────────────────────────────── */}
      {tab === 'tos' && (
        <DocumentTab
          title="Terms of Service Document"
          fieldKey="tos"
          value={localTos}
          onChange={setLocalTos}
          preview={previewTos}
          onTogglePreview={() => setPreviewTos((p) => !p)}
          onSave={() => save({ tos: localTos })}
          saving={saving}
          saved={savedField === 'tos'}
          lastSavedValue={config?.tos}
        />
      )}

      {/* ── Tab: Privacy Policy ───────────────────────────────────────── */}
      {tab === 'privacy' && (
        <DocumentTab
          title="Privacy Policy Document"
          fieldKey="privacyPolicy"
          value={localPrivacy}
          onChange={setLocalPrivacy}
          preview={previewPrivacy}
          onTogglePreview={() => setPreviewPrivacy((p) => !p)}
          onSave={() => save({ privacyPolicy: localPrivacy })}
          saving={saving}
          saved={savedField === 'privacyPolicy'}
          lastSavedValue={config?.privacyPolicy}
        />
      )}
    </div>
  );
}

// ─── Shared Helpers ───────────────────────────────────────────────────────────

function SavedIndicator() {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-green-600 font-medium">
      <Check size={14} /> Saved
    </span>
  );
}

interface DocumentTabProps {
  title: string;
  fieldKey: string;
  value: string;
  onChange: (val: string) => void;
  preview: boolean;
  onTogglePreview: () => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
  lastSavedValue?: string;
}

function DocumentTab({
  title,
  value,
  onChange,
  preview,
  onTogglePreview,
  onSave,
  saving,
  saved,
  lastSavedValue,
}: DocumentTabProps) {
  const charCount = value.length;
  const isDirty = value !== (lastSavedValue ?? '');

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
      {/* Card header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          {isDirty && (
            <p className="text-xs text-amber-600 mt-0.5">Unsaved changes</p>
          )}
        </div>
        <button
          onClick={onTogglePreview}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
        >
          {preview ? 'Edit' : 'Preview'}
        </button>
      </div>

      {/* Info box */}
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
        <AlertCircle size={13} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700">
          This document is version-controlled in the system audit log.
        </p>
      </div>

      {/* Editor or preview */}
      {preview ? (
        <div
          className="min-h-[400px] text-sm text-gray-800 leading-relaxed whitespace-pre-wrap border border-gray-200 rounded-lg px-4 py-3 bg-gray-50"
          aria-label="Document preview"
        >
          {value || <span className="text-gray-400 italic">No content yet.</span>}
        </div>
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full min-h-[400px] border border-gray-300 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y leading-relaxed"
          placeholder="Enter document content here…"
          spellCheck={false}
        />
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 pt-1 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          {charCount.toLocaleString()} {charCount === 1 ? 'character' : 'characters'}
        </p>
        <div className="flex items-center gap-3">
          {saved && <SavedIndicator />}
          <button
            onClick={onSave}
            disabled={saving}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors"
          >
            <Save size={13} />
            {saving ? 'Saving…' : `Save ${''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
