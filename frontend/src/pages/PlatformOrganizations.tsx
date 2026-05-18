import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';

interface Plan {
  id: string;
  tier: string;
  name: string;
}

interface PlatformOrganization {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  activeTicketCount: number;
  subscription?: {
    status: string;
    providerCustomerId?: string | null;
    paypalSubscriptionId?: string | null;
    plan: Plan;
  };
  _count: {
    users: number;
    locations: number;
    assets: number;
    tickets: number;
  };
}

const STATUSES = ['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED'];

export default function PlatformOrganizationsPage() {
  const qc = useQueryClient();
  const [savingId, setSavingId] = useState('');
  const { data: organizations, isLoading } = useQuery<PlatformOrganization[]>({
    queryKey: ['platform-organizations'],
    queryFn: () => api.get('/platform/organizations').then((r) => r.data),
  });
  const { data: plans } = useQuery<Plan[]>({
    queryKey: ['platform-plans'],
    queryFn: () => api.get('/platform/plans').then((r) => r.data),
  });

  const updateOrg = async (id: string, payload: Record<string, unknown>) => {
    setSavingId(id);
    try {
      await api.patch(`/platform/organizations/${id}`, payload);
      qc.invalidateQueries({ queryKey: ['platform-organizations'] });
      qc.invalidateQueries({ queryKey: ['platform-dashboard'] });
    } finally {
      setSavingId('');
    }
  };

  if (isLoading) return <div className="text-sm text-gray-400">Loading organizations...</div>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Organizations</h1>
        <p className="text-sm text-gray-500 mt-1">Manage tenant status, assigned plan, and organization role permissions.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Organization', 'Usage', 'Plan', 'Status', 'Active', 'Permissions'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {organizations?.map((org) => (
              <tr key={org.id} className="border-b border-gray-50 align-top">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{org.name}</div>
                  <div className="text-xs text-gray-400">{org.slug}</div>
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">
                  <div>{org._count.users} users</div>
                  <div>{org._count.locations} locations</div>
                  <div>{org._count.assets} assets</div>
                  <div>{org.activeTicketCount} active tickets</div>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={org.subscription?.plan.id ?? ''}
                    disabled={savingId === org.id}
                    onChange={(e) => updateOrg(org.id, { planId: e.target.value })}
                    className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
                  >
                    {plans?.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={org.subscription?.status ?? 'ACTIVE'}
                    disabled={savingId === org.id}
                    onChange={(e) => updateOrg(org.id, { status: e.target.value })}
                    className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
                  >
                    {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={org.active}
                    disabled={savingId === org.id}
                    onChange={(e) => updateOrg(org.id, { active: e.target.checked })}
                    className="rounded"
                  />
                </td>
                <td className="px-4 py-3">
                  <Link to={`/platform/organizations/${org.id}/roles`} className="text-blue-600 hover:text-blue-700 font-medium">
                    Edit roles
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
