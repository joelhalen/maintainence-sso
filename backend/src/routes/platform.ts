import { Router, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import { AuditAction, Permission, SubscriptionStatus, TicketStatus } from '@prisma/client';
import { AuthRequest } from '../types';
import { authenticate } from '../middleware/auth';
import { requirePlatformAdmin } from '../middleware/rbac';
import { AppError } from '../middleware/errorHandler';
import prisma from '../config/database';
import { writeAudit } from '../services/auditService';

const router = Router();
router.use(authenticate, requirePlatformAdmin);

const ACTIVE_TICKET_STATUSES = [
  TicketStatus.OPEN,
  TicketStatus.IN_PROGRESS,
  TicketStatus.ON_HOLD,
  TicketStatus.PENDING_PARTS,
  TicketStatus.PENDING_REVIEW,
];

router.get('/dashboard', async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const [
      totalOrganizations,
      activeOrganizations,
      activeTickets,
      overdueTickets,
      subscriptionsByStatus,
      subscriptionsByTier,
      organizationsWithActiveTickets,
      recentOrganizations,
    ] = await Promise.all([
      prisma.organization.count(),
      prisma.organization.count({ where: { active: true } }),
      prisma.ticket.count({ where: { status: { in: ACTIVE_TICKET_STATUSES } } }),
      prisma.ticket.count({ where: { status: { in: ACTIVE_TICKET_STATUSES }, dueDate: { lt: new Date() } } }),
      prisma.organizationSubscription.groupBy({ by: ['status'], _count: true }),
      prisma.organizationSubscription.groupBy({ by: ['planId'], _count: true }),
      prisma.ticket.groupBy({ by: ['organizationId'], where: { status: { in: ACTIVE_TICKET_STATUSES } } }),
      prisma.organization.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { subscription: { include: { plan: true } } },
      }),
    ]);

    const plans = await prisma.subscriptionPlan.findMany();
    const planById = new Map(plans.map((plan) => [plan.id, plan]));

    res.json({
      totalOrganizations,
      activeOrganizations,
      activeTickets,
      overdueTickets,
      organizationsWithActiveTickets: organizationsWithActiveTickets.length,
      subscriptionsByStatus,
      subscriptionsByTier: subscriptionsByTier.map((row) => ({
        tier: planById.get(row.planId)?.tier ?? 'UNKNOWN',
        planName: planById.get(row.planId)?.name ?? 'Unknown plan',
        _count: row._count,
      })),
      recentOrganizations,
    });
  } catch (e) {
    next(e);
  }
});

router.get('/organizations', async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const organizations = await prisma.organization.findMany({
      orderBy: { name: 'asc' },
      include: {
        subscription: { include: { plan: true } },
        _count: { select: { users: true, locations: true, assets: true, tickets: true } },
      },
    });

    const activeTicketCounts = await prisma.ticket.groupBy({
      by: ['organizationId'],
      where: { status: { in: ACTIVE_TICKET_STATUSES } },
      _count: true,
    });
    const activeTicketsByOrg = new Map(activeTicketCounts.map((row) => [row.organizationId, row._count]));

    res.json(organizations.map((org) => ({
      ...org,
      activeTicketCount: activeTicketsByOrg.get(org.id) ?? 0,
    })));
  } catch (e) {
    next(e);
  }
});

router.patch(
  '/organizations/:id',
  [
    param('id').notEmpty(),
    body('name').optional().trim().notEmpty(),
    body('active').optional().isBoolean(),
    body('planId').optional().notEmpty(),
    body('status').optional().isIn(Object.values(SubscriptionStatus)),
    body('providerCustomerId').optional({ nullable: true }).isString(),
    body('paypalSubscriptionId').optional({ nullable: true }).isString(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { next(new AppError(400, errors.array()[0].msg as string)); return; }

    try {
      const organization = await prisma.organization.findUnique({
        where: { id: req.params.id },
        include: { subscription: true },
      });
      if (!organization || !organization.subscription) {
        next(new AppError(404, 'Organization not found'));
        return;
      }

      if (req.body.planId) {
        const plan = await prisma.subscriptionPlan.findUnique({ where: { id: req.body.planId } });
        if (!plan) { next(new AppError(400, 'Subscription plan not found')); return; }
      }

      const updated = await prisma.$transaction(async (tx) => {
        if (req.body.name !== undefined || req.body.active !== undefined) {
          await tx.organization.update({
            where: { id: organization.id },
            data: {
              name: req.body.name,
              active: req.body.active,
            },
          });
        }

        if (
          req.body.planId !== undefined ||
          req.body.status !== undefined ||
          req.body.providerCustomerId !== undefined ||
          req.body.paypalSubscriptionId !== undefined
        ) {
          await tx.organizationSubscription.update({
            where: { organizationId: organization.id },
            data: {
              planId: req.body.planId,
              status: req.body.status,
              providerCustomerId: req.body.providerCustomerId,
              paypalSubscriptionId: req.body.paypalSubscriptionId,
            },
          });
        }

        return tx.organization.findUnique({
          where: { id: organization.id },
          include: { subscription: { include: { plan: true } } },
        });
      });

      await writeAudit({
        userId: req.user!.id,
        action: AuditAction.UPDATE,
        resource: 'platform_organizations',
        resourceId: organization.id,
        newValues: req.body,
        ...req.auditMeta,
      });

      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

router.get('/plans', async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({ orderBy: { tier: 'asc' } });
    res.json(plans);
  } catch (e) {
    next(e);
  }
});

router.patch(
  '/plans/:id',
  [
    param('id').notEmpty(),
    body('name').optional().trim().notEmpty(),
    body('description').optional({ nullable: true }).isString(),
    body('monthlyPriceCents').optional({ nullable: true }).isInt({ min: 0 }),
    body('maxActiveUsers').optional({ nullable: true }).isInt({ min: 0 }),
    body('maxLocations').optional({ nullable: true }).isInt({ min: 0 }),
    body('maxAssets').optional({ nullable: true }).isInt({ min: 0 }),
    body('maxActiveTickets').optional({ nullable: true }).isInt({ min: 0 }),
    body('allowSms').optional().isBoolean(),
    body('allowSso').optional().isBoolean(),
    body('allowExports').optional().isBoolean(),
    body('paypalPlanId').optional({ nullable: true }).isString(),
    body('active').optional().isBoolean(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { next(new AppError(400, errors.array()[0].msg as string)); return; }

    try {
      const plan = await prisma.subscriptionPlan.update({
        where: { id: req.params.id },
        data: req.body,
      });
      await writeAudit({
        userId: req.user!.id,
        action: AuditAction.UPDATE,
        resource: 'subscription_plans',
        resourceId: plan.id,
        newValues: req.body,
        ...req.auditMeta,
      });
      res.json(plan);
    } catch (e) {
      next(e);
    }
  }
);

router.get('/organizations/:organizationId/roles', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const roles = await prisma.role.findMany({
      where: { organizationId: req.params.organizationId },
      orderBy: { name: 'asc' },
    });
    res.json({ roles, permissions: Object.values(Permission) });
  } catch (e) {
    next(e);
  }
});

router.patch(
  '/organizations/:organizationId/roles/:roleId',
  [
    param('organizationId').notEmpty(),
    param('roleId').notEmpty(),
    body('permissions').isArray(),
    body('permissions.*').isIn(Object.values(Permission)),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { next(new AppError(400, errors.array()[0].msg as string)); return; }

    try {
      const role = await prisma.role.findFirst({
        where: { id: req.params.roleId, organizationId: req.params.organizationId },
      });
      if (!role) { next(new AppError(404, 'Role not found')); return; }

      const updated = await prisma.role.update({
        where: { id: role.id },
        data: { permissions: req.body.permissions },
      });
      await writeAudit({
        userId: req.user!.id,
        action: AuditAction.ROLE_CHANGE,
        resource: 'platform_roles',
        resourceId: role.id,
        oldValues: { permissions: role.permissions },
        newValues: { permissions: updated.permissions },
        ...req.auditMeta,
      });
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

export default router;
