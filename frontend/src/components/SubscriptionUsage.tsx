import { OrganizationContext, UsageSummary } from '../types';

type UsageKey = keyof UsageSummary;
type NumericLimitKey = 'maxActiveUsers' | 'maxLocations' | 'maxAssets' | 'maxActiveTickets';

const USAGE_LIMITS: Record<UsageKey, NumericLimitKey> = {
  activeUsers: 'maxActiveUsers',
  locations: 'maxLocations',
  assets: 'maxAssets',
  activeTickets: 'maxActiveTickets',
};

const LABELS: Record<UsageKey, string> = {
  activeUsers: 'Active users',
  locations: 'Locations',
  assets: 'Assets',
  activeTickets: 'Active tickets',
};

export function PlanBadge({ organization }: { organization: OrganizationContext }) {
  return (
    <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
      {organization.subscription.plan.name} plan
    </span>
  );
}

export function UsageMeter({
  organization,
  usage,
  usageKey,
}: {
  organization: OrganizationContext;
  usage: UsageSummary;
  usageKey: UsageKey;
}) {
  const limit = organization.subscription.plan.limits[USAGE_LIMITS[usageKey]];
  const current = usage[usageKey];
  const percent = limit ? Math.min(100, Math.round((current / limit) * 100)) : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-gray-600">
        <span>{LABELS[usageKey]}</span>
        <span>{current} / {limit ?? 'Unlimited'}</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full bg-blue-600" style={{ width: `${limit ? percent : 100}%` }} />
      </div>
    </div>
  );
}

export function isLimitReached(
  organization: OrganizationContext | null | undefined,
  usage: UsageSummary | undefined,
  usageKey: UsageKey
) {
  if (!organization || !usage) return false;
  const limit = organization.subscription.plan.limits[USAGE_LIMITS[usageKey]];
  return limit !== null && usage[usageKey] >= limit;
}

export function limitMessage(organization: OrganizationContext, usageKey: UsageKey) {
  const limit = organization.subscription.plan.limits[USAGE_LIMITS[usageKey]];
  return limit === null
    ? ''
    : `${LABELS[usageKey]} limit reached for the ${organization.subscription.plan.name} plan.`;
}
