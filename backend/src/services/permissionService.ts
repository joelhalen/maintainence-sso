import { Permission, RuleAction, RuleEffect, TicketType } from '@prisma/client';
import prisma from '../config/database';

/**
 * Returns the Prisma `where` clause fragment that restricts ticket visibility
 * for the given user based on their permission rules.
 *
 * Admins (REPORT_VIEW) always get an empty filter — they see every ticket.
 * For everyone else:
 *   - If they have explicit ALLOW rules for specific locations → restrict to those
 *   - DENY rules override ALLOWs at the same or broader scope
 *   - If they have NO location-specific rules → unrestricted (backwards-compatible)
 */
export async function getTicketVisibilityFilter(
  userId: string,
  rolePermissions: Permission[]
): Promise<Record<string, unknown>> {
  if (rolePermissions.includes(Permission.REPORT_VIEW)) return {};

  const groupIds = await getUserGroupIds(userId);

  const [allowRules, denyRules] = await Promise.all([
    prisma.permissionRule.findMany({
      where: {
        action: RuleAction.VIEW,
        effect: RuleEffect.ALLOW,
        locationId: { not: null },
        OR: [{ userId }, { groupId: { in: groupIds } }],
      },
      select: { locationId: true },
    }),
    prisma.permissionRule.findMany({
      where: {
        action: RuleAction.VIEW,
        effect: RuleEffect.DENY,
        locationId: { not: null },
        OR: [{ userId }, { groupId: { in: groupIds } }],
      },
      select: { locationId: true },
    }),
  ]);

  // No ALLOW rules → no location restriction (can see all, respecting only DENY)
  if (allowRules.length === 0) {
    if (denyRules.length === 0) return {};
    return { locationId: { notIn: denyRules.map((r) => r.locationId!) } };
  }

  const allowed = new Set(allowRules.map((r) => r.locationId!));
  const denied = new Set(denyRules.map((r) => r.locationId!));
  const visible = [...allowed].filter((id) => !denied.has(id));

  if (visible.length === 0) return { id: 'none' }; // No accessible locations
  return { locationId: { in: visible } };
}

/**
 * Checks whether the given user can perform `action` on a ticket at
 * `locationId` of type `ticketType`.
 *
 * Resolution order (most specific wins):
 *  1. Direct user rule scoped to this location + type
 *  2. Direct user rule scoped to this location only
 *  3. Direct user rule with no scope (global override)
 *  4. Same steps for group rules
 *  5. Fall back to role-level permission
 *
 * DENY always beats ALLOW at the same specificity level.
 */
export async function canPerformTicketAction(
  userId: string,
  rolePermissions: Permission[],
  action: RuleAction,
  locationId: string,
  ticketType: TicketType
): Promise<boolean> {
  const groupIds = await getUserGroupIds(userId);

  const rules = await prisma.permissionRule.findMany({
    where: {
      action,
      OR: [{ userId }, { groupId: { in: groupIds } }],
      AND: [
        {
          OR: [
            { locationId, ticketType },
            { locationId, ticketType: null },
            { locationId: null, ticketType },
            { locationId: null, ticketType: null },
          ],
        },
      ],
    },
    orderBy: { createdAt: 'asc' },
  });

  if (rules.length === 0) {
    return rolePermissions.includes(ruleActionToPermission(action));
  }

  // Most-specific rule wins; DENY beats ALLOW at same specificity
  const scored = rules.map((r) => ({
    ...r,
    score:
      (r.locationId ? 2 : 0) +
      (r.ticketType ? 1 : 0) +
      (r.userId ? 4 : 0), // direct user rules beat group rules
  }));
  scored.sort((a, b) => b.score - a.score);

  // Group rules at the same specificity: if any is DENY, deny wins
  const topScore = scored[0].score;
  const topRules = scored.filter((r) => r.score === topScore);
  if (topRules.some((r) => r.effect === RuleEffect.DENY)) return false;
  if (topRules.some((r) => r.effect === RuleEffect.ALLOW)) return true;

  return rolePermissions.includes(ruleActionToPermission(action));
}

async function getUserGroupIds(userId: string): Promise<string[]> {
  const memberships = await prisma.groupMembership.findMany({
    where: { userId },
    select: { groupId: true },
  });
  return memberships.map((m) => m.groupId);
}

function ruleActionToPermission(action: RuleAction): Permission {
  const map: Record<RuleAction, Permission> = {
    [RuleAction.VIEW]:           Permission.TICKET_READ,
    [RuleAction.COMMENT]:        Permission.TICKET_READ,
    [RuleAction.UPDATE_STATUS]:  Permission.TICKET_UPDATE,
    [RuleAction.CLOSE]:          Permission.TICKET_CLOSE,
    [RuleAction.ASSIGN]:         Permission.TICKET_ASSIGN,
    [RuleAction.CREATE]:         Permission.TICKET_CREATE,
    [RuleAction.EXPORT]:         Permission.TICKET_EXPORT,
  };
  return map[action];
}
