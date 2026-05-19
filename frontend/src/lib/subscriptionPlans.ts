export interface PublicPlan {
  tier: string;
  name: string;
  description?: string | null;
  monthlyPriceCents?: number | null;
  maxActiveUsers?: number | null;
  maxLocations?: number | null;
  maxAssets?: number | null;
  maxActiveTickets?: number | null;
  allowPush: boolean;
  allowSso: boolean;
  allowExports: boolean;
}

export const FALLBACK_PLANS: PublicPlan[] = [
  {
    tier: 'FREE',
    name: 'Free',
    description: 'Validate MegaMTX with a small team on a single site.',
    monthlyPriceCents: 0,
    maxActiveUsers: 5,
    maxLocations: 1,
    maxAssets: 25,
    maxActiveTickets: 25,
    allowPush: false,
    allowSso: false,
    allowExports: false,
  },
  {
    tier: 'STARTER',
    name: 'Starter',
    description: 'Entry cloud plan for single-site maintenance teams.',
    monthlyPriceCents: 4900,
    maxActiveUsers: 15,
    maxLocations: 3,
    maxAssets: 250,
    maxActiveTickets: 250,
    allowPush: true,
    allowSso: false,
    allowExports: true,
  },
  {
    tier: 'PROFESSIONAL',
    name: 'Professional',
    description: 'Multi-site operations with SSO and higher limits.',
    monthlyPriceCents: 14900,
    maxActiveUsers: 75,
    maxLocations: 25,
    maxAssets: 5000,
    maxActiveTickets: 2500,
    allowPush: true,
    allowSso: true,
    allowExports: true,
  },
  {
    tier: 'ENTERPRISE',
    name: 'Enterprise',
    description: 'Managed cloud or self-hosted with custom limits.',
    monthlyPriceCents: null,
    maxActiveUsers: null,
    maxLocations: null,
    maxAssets: null,
    maxActiveTickets: null,
    allowPush: true,
    allowSso: true,
    allowExports: true,
  },
];

export function formatPlanPrice(cents: number | null | undefined): string {
  if (cents == null) return 'Custom';
  if (cents === 0) return 'Free';
  return `$${(cents / 100).toFixed(0)}`;
}

export function formatLimit(value: number | null | undefined): string {
  if (value == null) return 'Unlimited';
  return value.toLocaleString();
}

export const TIER_STYLES: Record<string, { ring: string; badge: string; accent: string }> = {
  FREE: {
    ring: 'ring-gray-200',
    badge: 'bg-gray-100 text-gray-700',
    accent: 'text-gray-900',
  },
  STARTER: {
    ring: 'ring-blue-200',
    badge: 'bg-blue-50 text-blue-700',
    accent: 'text-blue-700',
  },
  PROFESSIONAL: {
    ring: 'ring-indigo-300 ring-2',
    badge: 'bg-indigo-600 text-white',
    accent: 'text-indigo-700',
  },
  ENTERPRISE: {
    ring: 'ring-violet-200',
    badge: 'bg-violet-50 text-violet-800',
    accent: 'text-violet-800',
  },
};
