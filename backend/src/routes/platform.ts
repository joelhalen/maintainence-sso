import { Router, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { AuditAction, Permission, Prisma, SubscriptionStatus, TicketStatus } from '@prisma/client';
import { AuthRequest } from '../types';
import { authenticate } from '../middleware/auth';
import { requirePlatformAdmin } from '../middleware/rbac';
import { AppError } from '../middleware/errorHandler';
import prisma from '../config/database';
import { writeAudit } from '../services/auditService';
import { createOrganizationUser, updateOrganizationUser } from '../services/userService';
import fs from 'fs/promises';
import path from 'path';

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

router.get(
  '/organizations/:id',
  [param('id').notEmpty()],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { next(new AppError(400, errors.array()[0].msg as string)); return; }

    try {
      const org = await prisma.organization.findUnique({
        where: { id: req.params.id },
        include: {
          subscription: { include: { plan: true } },
          users: {
            select: {
              id: true,
              name: true,
              email: true,
              active: true,
              isPlatformAdmin: true,
              createdAt: true,
              role: { select: { id: true, name: true } },
            },
          },
          roles: {
            select: {
              id: true,
              name: true,
              description: true,
              permissions: true,
            },
          },
          _count: {
            select: { users: true, locations: true, assets: true, tickets: true },
          },
        },
      });

      if (!org) {
        next(new AppError(404, 'Organization not found'));
        return;
      }

      const [activeTicketCount, recentTickets] = await Promise.all([
        prisma.ticket.count({
          where: { organizationId: org.id, status: { in: ACTIVE_TICKET_STATUSES } },
        }),
        prisma.ticket.findMany({
          where: { organizationId: org.id },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            ticketNumber: true,
            title: true,
            status: true,
            priority: true,
            createdAt: true,
          },
        }),
      ]);

      res.json({ ...org, activeTicketCount, recentTickets });
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  '/organizations',
  [
    body('name').trim().notEmpty(),
    body('slug').optional().trim(),
    body('planId').notEmpty(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { next(new AppError(400, errors.array()[0].msg as string)); return; }

    try {
      const { name, planId } = req.body as { name: string; slug?: string; planId: string };

      const slug: string = req.body.slug
        ? (req.body.slug as string).trim()
        : name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

      const existing = await prisma.organization.findUnique({ where: { slug } });
      if (existing) {
        next(new AppError(409, 'An organization with this slug already exists'));
        return;
      }

      const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
      if (!plan) {
        next(new AppError(400, 'Subscription plan not found'));
        return;
      }

      const created = await prisma.$transaction(async (tx) => {
        const org = await tx.organization.create({
          data: { name, slug },
        });

        await tx.organizationSubscription.create({
          data: {
            organizationId: org.id,
            planId: plan.id,
            status: 'ACTIVE',
          },
        });

        await tx.role.createMany({
          data: [
            {
              organizationId: org.id,
              name: 'Super Admin',
              description: 'Full system access',
              isSystem: true,
              permissions: Object.values(Permission),
            },
            {
              organizationId: org.id,
              name: 'Admin',
              description: 'Administrative access without system settings',
              isSystem: true,
              permissions: [
                Permission.TICKET_CREATE,
                Permission.TICKET_READ,
                Permission.TICKET_UPDATE,
                Permission.TICKET_DELETE,
                Permission.TICKET_ASSIGN,
                Permission.TICKET_CLOSE,
                Permission.TICKET_EXPORT,
                Permission.USER_CREATE,
                Permission.USER_READ,
                Permission.USER_UPDATE,
                Permission.USER_ASSIGN_ROLE,
                Permission.LOCATION_CREATE,
                Permission.LOCATION_READ,
                Permission.LOCATION_UPDATE,
                Permission.ASSET_CREATE,
                Permission.ASSET_READ,
                Permission.ASSET_UPDATE,
                Permission.REPORT_VIEW,
                Permission.REPORT_EXPORT,
                Permission.ADMIN_PANEL,
                Permission.AUDIT_LOG_VIEW,
                Permission.GROUP_MANAGE,
              ],
            },
            {
              organizationId: org.id,
              name: 'Supervisor',
              description: 'Can manage tickets and assign technicians',
              isSystem: true,
              permissions: [
                Permission.TICKET_CREATE,
                Permission.TICKET_READ,
                Permission.TICKET_UPDATE,
                Permission.TICKET_ASSIGN,
                Permission.TICKET_CLOSE,
                Permission.TICKET_EXPORT,
                Permission.USER_READ,
                Permission.LOCATION_READ,
                Permission.ASSET_READ,
                Permission.ASSET_UPDATE,
                Permission.REPORT_VIEW,
                Permission.REPORT_EXPORT,
              ],
            },
            {
              organizationId: org.id,
              name: 'Technician',
              description: 'Can work on assigned tickets',
              isSystem: true,
              permissions: [
                Permission.TICKET_CREATE,
                Permission.TICKET_READ,
                Permission.TICKET_UPDATE,
                Permission.LOCATION_READ,
                Permission.ASSET_READ,
              ],
            },
            {
              organizationId: org.id,
              name: 'Operator',
              description: 'Can create and view tickets',
              isSystem: true,
              permissions: [
                Permission.TICKET_CREATE,
                Permission.TICKET_READ,
                Permission.LOCATION_READ,
                Permission.ASSET_READ,
              ],
            },
            {
              organizationId: org.id,
              name: 'Viewer',
              description: 'Read-only access',
              isSystem: true,
              permissions: [
                Permission.TICKET_READ,
                Permission.LOCATION_READ,
                Permission.ASSET_READ,
              ],
            },
          ],
        });

        return tx.organization.findUnique({
          where: { id: org.id },
          include: { subscription: { include: { plan: true } } },
        });
      });

      await writeAudit({
        userId: req.user!.id,
        action: AuditAction.CREATE,
        resource: 'platform_organizations',
        resourceId: created!.id,
        newValues: { name, slug, planId },
        ...req.auditMeta,
      });

      res.status(201).json(created);
    } catch (e) {
      next(e);
    }
  }
);

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
    body('allowPush').optional().isBoolean(),
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

router.get(
  '/organizations/:organizationId/users/:userId',
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await prisma.user.findFirst({
        where: { id: req.params.userId, organizationId: req.params.organizationId },
        include: { role: { select: { id: true, name: true, description: true } } },
      });
      if (!user) { next(new AppError(404, 'User not found')); return; }
      const { passwordHash, ...safeUser } = user;
      res.json(safeUser);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  '/organizations/:organizationId/users',
  [
    param('organizationId').notEmpty(),
    body('email').isEmail().normalizeEmail(),
    body('name').trim().notEmpty(),
    body('roleId').notEmpty(),
    body('password').isLength({ min: 8 }),
    body('department').optional().trim(),
    body('active').optional().isBoolean(),
    body('isPlatformAdmin').optional().isBoolean(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { next(new AppError(400, errors.array()[0].msg as string)); return; }

    try {
      const user = await createOrganizationUser({
        organizationId: req.params.organizationId,
        email: req.body.email,
        name: req.body.name,
        roleId: req.body.roleId,
        password: req.body.password,
        department: req.body.department,
        active: req.body.active,
        isPlatformAdmin: req.body.isPlatformAdmin === true,
        auditUserId: req.user!.id,
        auditMeta: req.auditMeta,
      });
      res.status(201).json(user);
    } catch (e) {
      next(e);
    }
  }
);

router.patch(
  '/organizations/:organizationId/users/:userId',
  [
    param('organizationId').notEmpty(),
    param('userId').notEmpty(),
    body('email').optional().isEmail().normalizeEmail(),
    body('name').optional().trim().notEmpty(),
    body('roleId').optional().notEmpty(),
    body('password').optional().isLength({ min: 8 }),
    body('department').optional().trim(),
    body('active').optional().isBoolean(),
    body('isPlatformAdmin').optional().isBoolean(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { next(new AppError(400, errors.array()[0].msg as string)); return; }

    try {
      const user = await updateOrganizationUser({
        organizationId: req.params.organizationId,
        userId: req.params.userId,
        name: req.body.name,
        email: req.body.email,
        roleId: req.body.roleId,
        department: req.body.department,
        active: req.body.active,
        password: req.body.password,
        isPlatformAdmin: req.body.isPlatformAdmin,
        auditUserId: req.user!.id,
        auditMeta: req.auditMeta,
      });
      res.json(user);
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  '/audit',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('action').optional().isIn(Object.values(AuditAction)),
    query('resource').optional().isString(),
    query('userId').optional().isString(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { next(new AppError(400, errors.array()[0].msg as string)); return; }

    try {
      const page = (req.query.page as unknown as number) || 1;
      const limit = Math.min((req.query.limit as unknown as number) || 50, 100);
      const skip = (page - 1) * limit;

      const where: Prisma.AuditLogWhereInput = {};
      if (req.query.action) where.action = req.query.action as AuditAction;
      if (req.query.resource) where.resource = { contains: req.query.resource as string };
      if (req.query.userId) where.userId = req.query.userId as string;

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        }),
        prisma.auditLog.count({ where }),
      ]);

      res.json({
        logs,
        total,
        page,
        pages: Math.ceil(total / limit),
      });
    } catch (e) {
      next(e);
    }
  }
);

const SYSTEM_CONFIG_PATH = path.join(process.cwd(), 'data', 'system-config.json');

interface SystemConfig {
  tos: string;
  privacyPolicy: string;
  maintenanceMode: boolean;
  platformName: string;
}

const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  tos: '',
  privacyPolicy: '',
  maintenanceMode: false,
  platformName: 'MegaMTX',
};

async function readSystemConfig(): Promise<SystemConfig> {
  try {
    const raw = await fs.readFile(SYSTEM_CONFIG_PATH, 'utf-8');
    return { ...DEFAULT_SYSTEM_CONFIG, ...JSON.parse(raw) } as SystemConfig;
  } catch {
    return { ...DEFAULT_SYSTEM_CONFIG };
  }
}

router.get('/system-config', async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const config = await readSystemConfig();
    res.json(config);
  } catch (e) {
    next(e);
  }
});

router.patch(
  '/system-config',
  [
    body('tos').optional().isString(),
    body('privacyPolicy').optional().isString(),
    body('maintenanceMode').optional().isBoolean(),
    body('platformName').optional().isString(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { next(new AppError(400, errors.array()[0].msg as string)); return; }

    try {
      const existing = await readSystemConfig();
      const updated: SystemConfig = { ...existing };

      if (req.body.tos !== undefined) updated.tos = req.body.tos as string;
      if (req.body.privacyPolicy !== undefined) updated.privacyPolicy = req.body.privacyPolicy as string;
      if (req.body.maintenanceMode !== undefined) updated.maintenanceMode = req.body.maintenanceMode as boolean;
      if (req.body.platformName !== undefined) updated.platformName = req.body.platformName as string;

      await fs.mkdir(path.dirname(SYSTEM_CONFIG_PATH), { recursive: true });
      await fs.writeFile(SYSTEM_CONFIG_PATH, JSON.stringify(updated, null, 2), 'utf-8');

      await writeAudit({
        userId: req.user!.id,
        action: AuditAction.UPDATE,
        resource: 'system_config',
        resourceId: 'global',
        newValues: req.body,
        ...req.auditMeta,
      });

      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

export default router;
