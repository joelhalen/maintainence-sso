import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
}

type NumberField = 'monthlyPriceCents' | 'maxActiveUsers' | 'maxLocations' | 'maxAssets' | 'maxActiveTickets';

export default function PlatformPlansPage() {
  const qc = useQueryClient();
  const [savingId, setSavingId] = useState('');
  const { data: plans, isLoading } = useQuery<Plan[]>({
    queryKey: ['platform-plans'],
    queryFn: () => api.get('/platform/plans').then((r) => r.data),
  });

  const updatePlan = async (id: string, payload: Record<string, unknown>) => {
    setSavingId(id);
    try {
      await api.patch(`/platform/plans/${id}`, payload);
      qc.invalidateQueries({ queryKey: ['platform-plans'] });
      qc.invalidateQueries({ queryKey: ['platform-dashboard'] });
    } finally {
      setSavingId('');
    }
  };

  const numericValue = (plan: Plan, field: NumberField) => plan[field] ?? '';

  if (isLoading) return <div className="text-sm text-gray-400">Loading plans...</div>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Subscription Plans</h1>
        <p className="text-sm text-gray-500 mt-1">Adjust commercial tier limits and feature flags used by organization entitlements.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {plans?.map((plan) => (
          <div key={plan.id} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase">{plan.tier}</div>
                <input
                  value={plan.name}
                  disabled={savingId === plan.id}
                  onChange={(e) => updatePlan(plan.id, { name: e.target.value })}
                  className="text-lg font-semibold text-gray-900 border-b border-transparent hover:border-gray-300 focus:border-blue-500 outline-none"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={plan.active} onChange={(e) => updatePlan(plan.id, { active: e.target.checked })} />
                Active
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {([
                ['monthlyPriceCents', 'Monthly cents'],
                ['maxActiveUsers', 'Users'],
                ['maxLocations', 'Locations'],
                ['maxAssets', 'Assets'],
                ['maxActiveTickets', 'Active tickets'],
              ] as [NumberField, string][]).map(([field, label]) => (
                <div key={field}>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="Unlimited"
                    value={numericValue(plan, field)}
                    disabled={savingId === plan.id}
                    onChange={(e) => updatePlan(plan.id, { [field]: e.target.value === '' ? null : Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={plan.allowPush} onChange={(e) => updatePlan(plan.id, { allowPush: e.target.checked })} />
                Push
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={plan.allowSso} onChange={(e) => updatePlan(plan.id, { allowSso: e.target.checked })} />
                SSO
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={plan.allowExports} onChange={(e) => updatePlan(plan.id, { allowExports: e.target.checked })} />
                Exports
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
