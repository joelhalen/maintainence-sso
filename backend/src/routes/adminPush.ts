import { Router, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { body, param, validationResult } from 'express-validator';
import { AuditAction, Permission } from '@prisma/client';
import { AuthRequest } from '../types';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { AppError } from '../middleware/errorHandler';
import prisma from '../config/database';
import { getFcmConfigStatus } from '../config/firebase';
import { sendPushToUser } from '../services/pushNotificationService';
import { writeAudit } from '../services/auditService';

const router = Router();
const testSendLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });

router.use(authenticate, requirePermission(Permission.EMAIL_SETTINGS));

router.get('/config-status', (_req: AuthRequest, res: Response): void => {
  res.json(getFcmConfigStatus());
});

router.get('/users', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      where: { organizationId: req.user!.organizationId, active: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });

    const deviceCounts = await prisma.deviceToken.groupBy({
      by: ['userId'],
      where: { organizationId: req.user!.organizationId, active: true },
      _count: { token: true },
    });

    const countMap = new Map(deviceCounts.map((d) => [d.userId, d._count.token]));

    res.json(users.map((user) => ({
      ...user,
      deviceCount: countMap.get(user.id) ?? 0,
      pushCapable: (countMap.get(user.id) ?? 0) > 0,
    })));
  } catch (e) {
    next(e);
  }
});

router.post(
  '/test',
  testSendLimiter,
  [
    body('userId').notEmpty(),
    body('title').optional().trim().isLength({ max: 100 }),
    body('body').optional().trim().isLength({ max: 500 }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { next(new AppError(400, errors.array()[0].msg as string)); return; }

    try {
      if (!req.user!.isPlatformAdmin && !req.user!.organization.subscription.plan.limits.allowPush) {
        next(new AppError(402, 'Push notifications are not included in the current subscription plan'));
        return;
      }

      const user = await prisma.user.findFirst({
        where: { id: req.body.userId, organizationId: req.user!.organizationId, active: true },
        select: { id: true, name: true },
      });
      if (!user) { next(new AppError(404, 'User not found')); return; }

      const title = req.body.title || `${process.env.COMPANY_NAME || 'MegaMTX'} Test`;
      const body = req.body.body || `Test push notification for ${user.name}.`;

      const result = await sendPushToUser(user.id, { title, body }, {
        organizationId: req.user!.organizationId,
        templateName: 'test',
      });

      await writeAudit({
        organizationId: req.user!.organizationId,
        userId: req.user!.id,
        action: AuditAction.CREATE,
        resource: 'push_test',
        resourceId: user.id,
        newValues: { toUserId: user.id, ...result },
        ...req.auditMeta,
      });

      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

router.get('/logs', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || '1'));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '25')));
    const [data, total] = await Promise.all([
      prisma.pushLog.findMany({
        where: { organizationId: req.user!.organizationId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
          ticket: { select: { id: true, ticketNumber: true, title: true } },
        },
      }),
      prisma.pushLog.count({ where: { organizationId: req.user!.organizationId } }),
    ]);

    res.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (e) {
    next(e);
  }
});

router.get('/logs/:id', [param('id').notEmpty()], async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const log = await prisma.pushLog.findFirst({
      where: { id: req.params.id, organizationId: req.user!.organizationId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        ticket: { select: { id: true, ticketNumber: true, title: true } },
      },
    });
    if (!log) { next(new AppError(404, 'Push log not found')); return; }
    res.json(log);
  } catch (e) {
    next(e);
  }
});

export default router;
