import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, AlertCircle } from 'lucide-react';
import api from '../api/client';

interface Plan {
  id: string;
  tier: string;
  name: string;
  monthlyPriceCents?: number | null;
  maxActiveUsers?: number | null;
  maxLocations?: number | null;
  maxAssets?: number | null;
  maxActiveTickets?: number | null;
  allowPush: boolean;
  allowSso: boolean;
  allowExports: boolean;
  active: boolean;
  paypalPlanId?: string | null;
}

type PlanField = keyof Plan;

const TIER_HEADER: Record<string, string> = {
  FREE: 'bg-gray-100 border-gray-200',
  STARTER: 'bg-blue-50 border-blue-200',
  PROFESSIONAL: 'bg-indigo-50 border-indigo-200',
  ENTERPRISE: 'bg-violet-50 border-violet-200',
};

const TIER_ACCENT: Record<string, string> = {
  FREE: 'text-gray-500',
  STARTER: 'text-blue-600',
  PROFESSIONAL: 'text-indigo-700',
  ENTERPRISE: 'text-violet-800',
};

const TIER_BORDER: Record<string, string> = {
  FREE: 'border-t-gray-300',
  STARTER: 'border-t-blue-400',
  PROFESSIONAL: 'border-t-indigo-500',
  ENTERPRISE: 'border-t-violet-600',
};

function formatPrice(cents: number | null | undefined): string {
  if (cents == null) return 'Custom pricing';
  return `$${(cents / 100).toFixed(2)}/mo`;
}

type ToastState = { type: 'success' | 'error'; message: string } | null;

interface PlanCardProps {
  serverPlan: Plan;
  onSave: (id: string, payload: Partial<Plan>) => Promise<void>;
}

function PlanCard({ serverPlan, onSave }: PlanCardProps) {
  const [local, setLocal] = useState<Plan>(serverPlan);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  // Sync when server data changes (e.g., after query invalidation)
  useEffect(() => {
    setLocal(serverPlan);
  }, [serverPlan]);

  const isDirty = JSON.stringify(local) !== JSON.stringify(serverPlan);

  const set = useCallback(<K extends PlanField>(field: K, value: Plan[K]) => {
    setLocal((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setToast(null);
    try {
      // Compute diff — only send changed fields
      const payload: Partial<Plan> = {};
      (Object.keys(local) as PlanField[]).forEach((k) => {
        if (local[k] !== serverPlan[k]) {
          (payload as Record<string, unknown>)[k] = local[k];
        }
      });
      await onSave(serverPlan.id, payload);
      setToast({ type: 'success', message: 'Changes saved successfully' });
    } catch {
      setToast({ type: 'error', message: 'Failed to save changes' });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const headerClass = TIER_HEADER[local.tier] ?? 'bg-gray-50 border-gray-200';
  const accentClass = TIER_ACCENT[local.tier] ?? 'text-gray-600';
  const borderClass = TIER_BORDER[local.tier] ?? 'border-t-gray-300';

  const priceDisplay = local.monthlyPriceCents != null
    ? `$${(local.monthlyPriceCents / 100).toFixed(2)}/mo`
    : 'Custom pricing';

  const numericInput = (
    field: 'maxActiveUsers' | 'maxLocations' | 'maxAssets' | 'maxActiveTickets',
    label: string,
  ) => (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input
        type="number"
        min={0}
        placeholder="Unlimited"
        value={local[field] ?? ''}
        disabled={saving}
        onChange={(e) =>
          set(field, e.target.value === '' ? null : Number(e.target.value))
        }
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-60"
      />
    </div>
  );

  const featureToggle = (field: 'allowPush' | 'allowSso' | 'allowExports', label: string) => (
    <button
      type="button"
      onClick={() => set(field, !local[field])}
      disabled={saving}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-60 ${
        local[field]
          ? 'bg-green-50 border-green-200 text-green-700'
          : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
      }`}
    >
      <span
        className={`inline-block w-2 h-2 rounded-full ${local[field] ? 'bg-green-500' : 'bg-gray-300'}`}
      />
      {label}
    </button>
  );

  return (
    <div className={`bg-white rounded-xl border-2 shadow-sm overflow-hidden ${borderClass}`}>
      {/* Colored tier header */}
      <div className={`${headerClass} border-b px-5 py-4`}>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${accentClass}`}>
              {local.tier}
            </div>
            <input
              value={local.name}
              disabled={saving}
              onChange={(e) => set('name', e.target.value)}
              className="text-lg font-semibold text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none w-full pr-2 disabled:opacity-60"
            />
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-gray-600 flex-shrink-0 ml-4 cursor-pointer">
            <span className={`text-xs ${local.active ? 'text-green-700' : 'text-gray-400'}`}>
              {local.active ? 'Active' : 'Inactive'}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={local.active}
              disabled={saving}
              onClick={() => set('active', !local.active)}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-50 ${
                local.active ? 'bg-green-500' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  local.active ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </label>
        </div>
      </div>

      <div className="px-5 py-4 space-y-5">
        {/* Pricing section */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Pricing</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Monthly Price (cents)</label>
              <input
                type="number"
                min={0}
                placeholder="Custom pricing"
                value={local.monthlyPriceCents ?? ''}
                disabled={saving}
                onChange={(e) =>
                  set('monthlyPriceCents', e.target.value === '' ? null : Number(e.target.value))
                }
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-60"
              />
              <p className="text-xs text-gray-400 mt-1">{priceDisplay}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">PayPal Plan ID</label>
              <input
                type="text"
                value={local.paypalPlanId ?? ''}
                disabled={saving}
                onChange={(e) => set('paypalPlanId', e.target.value || null)}
                placeholder="P-XXXXXXXXXXXX"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-60"
              />
            </div>
          </div>
        </div>

        {/* Usage limits */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Usage Limits
          </h3>
          <p className="text-xs text-gray-400 mb-3">Leave blank for unlimited</p>
          <div className="grid grid-cols-2 gap-3">
            {numericInput('maxActiveUsers', 'Users')}
            {numericInput('maxLocations', 'Locations')}
            {numericInput('maxAssets', 'Assets')}
            {numericInput('maxActiveTickets', 'Active Tickets')}
          </div>
        </div>

        {/* Features */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Features</h3>
          <div className="flex flex-wrap gap-2">
            {featureToggle('allowPush', 'Push')}
            {featureToggle('allowSso', 'SSO')}
            {featureToggle('allowExports', 'Exports')}
          </div>
        </div>

        {/* Footer: toast + save button */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div className="flex-1 mr-3">
            {toast && (
              <div
                className={`flex items-center gap-1.5 text-xs ${
                  toast.type === 'success' ? 'text-green-700' : 'text-red-600'
                }`}
              >
                {toast.type === 'success' ? (
                  <CheckCircle size={13} />
                ) : (
                  <AlertCircle size={13} />
                )}
                {toast.message}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || saving}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
              isDirty && !saving
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {saving ? 'Saving...' : isDirty ? 'Save Changes' : 'No Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2 animate-pulse">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="h-20 bg-gray-100 border-b border-gray-200" />
          <div className="p-5 space-y-4">
            <div className="h-4 bg-gray-100 rounded w-1/3" />
            <div className="grid grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((j) => (
                <div key={j} className="h-10 bg-gray-100 rounded-lg" />
              ))}
            </div>
            <div className="flex gap-2">
              {[0, 1, 2].map((j) => (
                <div key={j} className="h-7 w-16 bg-gray-100 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PlatformPlansPage() {
  const qc = useQueryClient();
  const { data: plans, isLoading, isError, error, refetch } = useQuery<Plan[]>({
    queryKey: ['platform-plans'],
    queryFn: () => api.get('/platform/plans').then((r) => r.data),
  });

  const savePlan = useCallback(
    async (id: string, payload: Partial<Plan>) => {
      await api.patch(`/platform/plans/${id}`, payload);
      qc.invalidateQueries({ queryKey: ['platform-plans'] });
      qc.invalidateQueries({ queryKey: ['platform-dashboard'] });
    },
    [qc],
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Subscription Plans</h1>
        <p className="text-sm text-gray-500 mt-1">
          Adjust commercial tier limits and feature flags used by organization entitlements.
        </p>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : isError ? (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-4 space-y-3">
          <p className="flex items-center gap-2 text-sm text-red-700">
            <AlertCircle size={16} />
            Failed to load subscription plans. The API may be unavailable or your session may have expired.
          </p>
          <p className="text-xs text-red-600">
            {(error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Request failed'}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="text-sm font-medium text-red-700 underline underline-offset-2 hover:text-red-800"
          >
            Try again
          </button>
        </div>
      ) : !plans?.length ? (
        <p className="bg-white border border-gray-200 rounded-xl px-4 py-10 text-center text-sm text-gray-500">
          No subscription plans found. Run the database seed to create default tiers.
        </p>
      ) : (
        <>
          <ul className="flex flex-wrap gap-2 list-none m-0 p-0">
            {plans.map((p) => (
              <li key={p.id}>
              <span
                className="text-xs px-2.5 py-1 rounded-full bg-white border border-gray-200 text-gray-600"
              >
                {p.name} — {formatPrice(p.monthlyPriceCents)}
              </span>
              </li>
            ))}
          </ul>

          <section className="grid gap-4 lg:grid-cols-2">
            {plans.map((plan) => (
              <PlanCard key={plan.id} serverPlan={plan} onSave={savePlan} />
            ))}
          </section>
        </>
      )}
    </div>
  );
}
