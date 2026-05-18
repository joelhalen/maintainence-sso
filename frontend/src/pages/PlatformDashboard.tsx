import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Building2, CheckCircle, Ticket } from 'lucide-react';
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

export default function PlatformDashboardPage() {
  const { data, isLoading } = useQuery<PlatformSummary>({
    queryKey: ['platform-dashboard'],
    queryFn: () => api.get('/platform/dashboard').then((r) => r.data),
  });

  if (isLoading) return <div className="text-sm text-gray-400">Loading platform dashboard...</div>;

  const stats = [
    { label: 'Organizations', value: data?.totalOrganizations ?? 0, icon: Building2, color: 'bg-blue-600' },
    { label: 'Active Orgs', value: data?.activeOrganizations ?? 0, icon: CheckCircle, color: 'bg-green-600' },
    { label: 'Orgs With Active Tickets', value: data?.organizationsWithActiveTickets ?? 0, icon: Ticket, color: 'bg-indigo-600' },
    { label: 'Overdue Tickets', value: data?.overdueTickets ?? 0, icon: AlertTriangle, color: 'bg-red-600' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Platform Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Global MegaMTX cloud operations across all organizations.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
              </div>
              <div className={`${color} p-3 rounded-xl`}>
                <Icon size={20} className="text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Subscriptions by Tier</h2>
          <div className="space-y-3">
            {data?.subscriptionsByTier.map((row) => (
              <div key={row.tier} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{row.planName}</span>
                <span className="font-semibold text-gray-900">{row._count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Recent Organizations</h2>
          <div className="space-y-3">
            {data?.recentOrganizations.map((org) => (
              <div key={org.id} className="flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium text-gray-900">{org.name}</div>
                  <div className="text-xs text-gray-400">{org.slug}</div>
                </div>
                <div className="text-right">
                  <div className="text-gray-700">{org.subscription?.plan.name ?? 'No plan'}</div>
                  <div className="text-xs text-gray-400">{org.subscription?.status ?? 'Unconfigured'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
