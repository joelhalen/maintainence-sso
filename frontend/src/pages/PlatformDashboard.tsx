import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Building2, CheckCircle, RefreshCw, Ticket } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api/client';

interface PlatformSummary {
  totalOrganizations: number;
  activeOrganizations: number;
  activeTickets: number;
  overdueTickets: number;
  organizationsWithActiveTickets: number;
  subscriptionsByStatus: { status: string; _count: number }[];
  subscriptionsByTier: { tier: string; planName: string; _count: number }[];
  recentOrganizations: {
    id: string;
    name: string;
    slug: string;
    active: boolean;
    subscription?: { status: string; plan: { name: string; tier: string } };
  }[];
}

const TIER_BADGE: Record<string, string> = {
  FREE: 'bg-gray-100 text-gray-600',
  STARTER: 'bg-blue-100 text-blue-700',
  PROFESSIONAL: 'bg-indigo-100 text-indigo-700',
  ENTERPRISE: 'bg-violet-100 text-violet-700',
};

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  TRIALING: 'bg-blue-100 text-blue-700',
  PAST_DUE: 'bg-amber-100 text-amber-700',
  CANCELED: 'bg-red-100 text-red-700',
  EXPIRED: 'bg-gray-100 text-gray-500',
};

const TIER_BAR: Record<string, string> = {
  FREE: 'bg-gray-400',
  STARTER: 'bg-blue-500',
  PROFESSIONAL: 'bg-indigo-600',
  ENTERPRISE: 'bg-violet-700',
};

const STATUS_BAR: Record<string, string> = {
  ACTIVE: 'bg-green-500',
  TRIALING: 'bg-blue-500',
  PAST_DUE: 'bg-amber-500',
  CANCELED: 'bg-red-500',
  EXPIRED: 'bg-gray-400',
};

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 h-28">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-3" />
            <div className="h-8 bg-gray-200 rounded w-1/3" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 h-48">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-4" />
            {[0, 1, 2, 3].map((j) => (
              <div key={j} className="h-3 bg-gray-100 rounded mb-3" />
            ))}
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-5 h-64">
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-4" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 bg-gray-50 rounded mb-2" />
        ))}
      </div>
    </div>
  );
}

export default function PlatformDashboardPage() {
  const qc = useQueryClient();
  const { data, isLoading, isFetching } = useQuery<PlatformSummary>({
    queryKey: ['platform-dashboard'],
    queryFn: () => api.get('/platform/dashboard').then((r) => r.data),
  });

  if (isLoading) return <LoadingSkeleton />;

  const total = data?.totalOrganizations ?? 0;
  const active = data?.activeOrganizations ?? 0;
  const activeTickets = data?.activeTickets ?? 0;
  const overdueTickets = data?.overdueTickets ?? 0;

  const stats = [
    {
      label: 'Total Organizations',
      value: total,
      icon: Building2,
      iconBg: 'bg-blue-600',
      sub: null as string | null,
      cardBg: 'bg-white',
    },
    {
      label: 'Active Organizations',
      value: active,
      icon: CheckCircle,
      iconBg: 'bg-green-600',
      sub: total > 0 ? `${active} of ${total} active` : null,
      cardBg: 'bg-white',
    },
    {
      label: 'Active Tickets',
      value: activeTickets,
      icon: Ticket,
      iconBg: 'bg-indigo-600',
      sub: `across ${data?.organizationsWithActiveTickets ?? 0} orgs`,
      cardBg: 'bg-white',
    },
    {
      label: 'Overdue Tickets',
      value: overdueTickets,
      icon: AlertTriangle,
      iconBg: overdueTickets > 0 ? 'bg-red-600' : 'bg-gray-400',
      sub: overdueTickets > 0 ? 'Requires attention' : 'All on track',
      cardBg: overdueTickets > 0 ? 'bg-red-50' : 'bg-white',
    },
  ];

  const tierTotal = (data?.subscriptionsByTier ?? []).reduce((s, r) => s + r._count, 0) || 1;
  const statusTotal = (data?.subscriptionsByStatus ?? []).reduce((s, r) => s + r._count, 0) || 1;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Platform Overview</h1>
          <p className="text-sm text-gray-500 mt-1">Global system health and tenant metrics.</p>
        </div>
        <button
          onClick={() => qc.invalidateQueries({ queryKey: ['platform-dashboard'] })}
          disabled={isFetching}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, iconBg, sub, cardBg }) => (
          <div key={label} className={`${cardBg} rounded-xl border border-gray-200 shadow-sm p-5`}>
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">{label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1 tabular-nums">{value}</p>
                {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
              </div>
              <div className={`${iconBg} p-2.5 rounded-lg flex-shrink-0`}>
                <Icon size={18} className="text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Distribution cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Subscription by tier */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Subscription Distribution</h2>
          <div className="space-y-3">
            {(data?.subscriptionsByTier ?? []).map((row) => {
              const pct = Math.round((row._count / tierTotal) * 100);
              return (
                <div key={row.tier}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TIER_BADGE[row.tier] ?? 'bg-gray-100 text-gray-600'}`}>
                        {row.tier}
                      </span>
                      <span className="text-xs text-gray-500 truncate">{row.planName}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 tabular-nums ml-2 flex-shrink-0">{row._count}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${TIER_BAR[row.tier] ?? 'bg-gray-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {(data?.subscriptionsByTier ?? []).length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No subscription data</p>
            )}
          </div>
        </div>

        {/* Subscription by status */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">By Status</h2>
          <div className="space-y-3">
            {(data?.subscriptionsByStatus ?? []).map((row) => {
              const pct = Math.round((row._count / statusTotal) * 100);
              return (
                <div key={row.status}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[row.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {row.status}
                    </span>
                    <span className="text-sm font-semibold text-gray-900 tabular-nums">{row._count}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${STATUS_BAR[row.status] ?? 'bg-gray-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {(data?.subscriptionsByStatus ?? []).length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No status data</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent organizations table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Recently Onboarded Organizations</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Organization', 'Plan', 'Status', 'Active'].map((h) => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {(data?.recentOrganizations ?? []).map((org) => (
              <tr key={org.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3">
                  <Link
                    to={`/platform/organizations/${org.id}`}
                    className="font-medium text-gray-900 hover:text-blue-600 transition-colors"
                  >
                    {org.name}
                  </Link>
                  <div className="text-xs text-gray-400 mt-0.5">{org.slug}</div>
                </td>
                <td className="px-5 py-3">
                  {org.subscription ? (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TIER_BADGE[org.subscription.plan.tier] ?? 'bg-gray-100 text-gray-600'}`}>
                      {org.subscription.plan.tier}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">No plan</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  {org.subscription ? (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[org.subscription.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {org.subscription.status}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">Unconfigured</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <span className={`inline-block w-2 h-2 rounded-full ${org.active ? 'bg-green-500' : 'bg-gray-300'}`} />
                </td>
              </tr>
            ))}
            {(data?.recentOrganizations ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-sm text-gray-400">
                  No organizations yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
