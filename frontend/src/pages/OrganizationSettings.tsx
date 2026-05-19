import { useQuery } from '@tanstack/react-query';
import { CreditCard } from 'lucide-react';
import api from '../api/client';
import { OrganizationSubscriptionResponse } from '../types';
import { PlanBadge, UsageMeter } from '../components/SubscriptionUsage';

export default function OrganizationSettingsPage() {
  const { data, isLoading } = useQuery<OrganizationSubscriptionResponse>({
    queryKey: ['organization-subscription'],
    queryFn: () => api.get('/organizations/subscription').then((r) => r.data),
  });

  if (isLoading) {
    return <div className="text-sm text-gray-400">Loading organization settings...</div>;
  }

  if (!data) {
    return <div className="text-sm text-gray-500">Organization subscription details are unavailable.</div>;
  }

  const { organization, usage, billing } = data;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Organization &amp; Subscription</h1>
        <p className="text-sm text-gray-500 mt-1">
          Review tenant details, plan limits, and PayPal billing readiness for {organization.name}.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Organization</div>
            <div className="text-lg font-semibold text-gray-900">{organization.name}</div>
            <div className="text-xs text-gray-500">Slug: {organization.slug}</div>
          </div>
          <PlanBadge organization={organization} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <UsageMeter organization={organization} usage={usage} usageKey="activeUsers" />
          <UsageMeter organization={organization} usage={usage} usageKey="locations" />
          <UsageMeter organization={organization} usage={usage} usageKey="assets" />
          <UsageMeter organization={organization} usage={usage} usageKey="activeTickets" />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <CreditCard size={18} className="text-gray-400" />
          <h2 className="text-base font-semibold text-gray-900">Billing Provider</h2>
        </div>
        <div className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <div className="text-xs text-gray-400 uppercase font-semibold">Provider</div>
            <div className="text-gray-900">{billing?.provider ?? organization.subscription?.provider ?? '—'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 uppercase font-semibold">Status</div>
            <div className="text-gray-900">{organization.subscription?.status ?? '—'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 uppercase font-semibold">PayPal Subscription</div>
            <div className="text-gray-900">{billing?.paypalSubscriptionId ?? 'Not connected yet'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 uppercase font-semibold">Checkout</div>
            <div className="text-gray-900">{billing?.checkoutEnabled ? 'Enabled' : 'Scaffolded for later integration'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
