import { SubscriptionStatus, TicketStatus } from '@prisma/client';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { OrganizationContext, SubscriptionLimits } from '../types';

export type LimitedResource = 'users' | 'locations' | 'assets' | 'activeTickets';

export interface UsageSummary {
  activeUsers: number;
  locations: number;
  assets: number;
  activeTickets: number;
}

type OrganizationWithSubscription = NonNullable<Awaited<ReturnType<typeof getOrganizationForContext>>>;
type SubscriptionWithPlan = NonNullable<OrganizationWithSubscription['subscription']>;
const ACTIVE_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIALING,
];

function toLimits(plan: SubscriptionWithPlan['plan']): SubscriptionLimits {
  return {
    maxActiveUsers: plan.maxActiveUsers,
    maxLocations: plan.maxLocations,
    maxAssets: plan.maxAssets,
    maxActiveTickets: plan.maxActiveTickets,
    allowSms: plan.allowSms,
    allowSso: plan.allowSso,
    allowExports: plan.allowExports,
  };
}

export async function getOrganizationForContext(organizationId: string) {
  return prisma.organization.findFirst({
    where: { id: organizationId, active: true },
    include: { subscription: { include: { plan: true } } },
  });
}

export function toOrganizationContext(organization: OrganizationWithSubscription): OrganizationContext {
  if (!organization.subscription) {
    throw new AppError(403, 'Organization subscription is not configured');
  }

  const { subscription } = organization;
  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    subscription: {
      status: subscription.status,
      provider: subscription.provider,
      providerCustomerId: subscription.providerCustomerId,
      paypalSubscriptionId: subscription.paypalSubscriptionId,
      plan: {
        id: subscription.plan.id,
        tier: subscription.plan.tier,
        name: subscription.plan.name,
        limits: toLimits(subscription.plan),
      },
    },
  };
}

export async function getUsageSummary(organizationId: string): Promise<UsageSummary> {
  const activeTicketStatuses = [
    TicketStatus.OPEN,
    TicketStatus.IN_PROGRESS,
    TicketStatus.ON_HOLD,
    TicketStatus.PENDING_PARTS,
    TicketStatus.PENDING_REVIEW,
  ];

  const [activeUsers, locations, assets, activeTickets] = await Promise.all([
    prisma.user.count({ where: { organizationId, active: true } }),
    prisma.location.count({ where: { organizationId, active: true } }),
    prisma.asset.count({ where: { organizationId, active: true } }),
    prisma.ticket.count({ where: { organizationId, status: { in: activeTicketStatuses } } }),
  ]);

  return { activeUsers, locations, assets, activeTickets };
}

export async function assertWithinLimit(
  organization: OrganizationContext,
  resource: LimitedResource
): Promise<void> {
  if (!ACTIVE_SUBSCRIPTION_STATUSES.includes(organization.subscription.status)) {
    throw new AppError(402, 'Organization subscription is not active');
  }

  const usage = await getUsageSummary(organization.id);
  const limits = organization.subscription.plan.limits;
  const checks: Record<LimitedResource, { current: number; limit: number | null; label: string }> = {
    users: { current: usage.activeUsers, limit: limits.maxActiveUsers, label: 'active users' },
    locations: { current: usage.locations, limit: limits.maxLocations, label: 'locations' },
    assets: { current: usage.assets, limit: limits.maxAssets, label: 'assets' },
    activeTickets: { current: usage.activeTickets, limit: limits.maxActiveTickets, label: 'active tickets' },
  };

  const check = checks[resource];
  if (check.limit !== null && check.current >= check.limit) {
    throw new AppError(402, `Subscription limit reached for ${check.label}. Upgrade your plan to add more.`);
  }
}
