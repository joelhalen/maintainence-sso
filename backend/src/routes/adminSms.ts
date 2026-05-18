import { Router, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { body, param, validationResult } from 'express-validator';
import { AuditAction, Permission } from '@prisma/client';
import { AuthRequest } from '../types';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { AppError } from '../middleware/errorHandler';
import prisma from '../config/database';
import { getTwilioConfigStatus } from '../config/twilio';
import { isSmsCapablePhone, sendSms } from '../services/smsService';
import { writeAudit } from '../services/auditService';

const router = Router();
const testSendLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });

router.use(authenticate, requirePermission(Permission.EMAIL_SETTINGS));

router.get('/config-status', async (_req: AuthRequest, res: Response): Promise<void> => {
  res.json(getTwilioConfigStatus());
});

router.get('/users', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      where: { organizationId: req.user!.organizationId, active: true },
      select: { id: true, name: true, email: true, phone: true },
      orderBy: { name: 'asc' },
    });

    res.json(users.map((user) => ({ ...user, smsCapable: isSmsCapablePhone(user.phone) })));
  } catch (e) {
    next(e);
  }
});

router.post(
  '/test',
  testSendLimiter,
  [
    body('userId').notEmpty(),
    body('body').optional().trim().isLength({ max: 500 }).withMessage('Message must be 500 characters or less'),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { next(new AppError(400, errors.array()[0].msg as string)); return; }

    try {
      if (!req.user!.isPlatformAdmin && !req.user!.organization.subscription.plan.limits.allowSms) {
        next(new AppError(402, 'SMS is not included in the current subscription plan'));
        return;
      }

      const user = await prisma.user.findFirst({
        where: { id: req.body.userId, organizationId: req.user!.organizationId, active: true },
        select: { id: true, name: true, phone: true },
      });
      if (!user) { next(new AppError(404, 'User not found')); return; }
      if (!isSmsCapablePhone(user.phone)) {
        next(new AppError(400, 'Selected user does not have an SMS-capable E.164 phone number'));
        return;
      }

      const message = req.body.body || `${process.env.COMPANY_NAME || 'MegaMTX'} test text message for ${user.name}.`;
      const sent = await sendSms({
        organizationId: req.user!.organizationId,
        userId: user.id,
        to: user.phone,
        body: message,
      });

      await writeAudit({
        organizationId: req.user!.organizationId,
        userId: req.user!.id,
        action: AuditAction.CREATE,
        resource: 'sms_test',
        resourceId: user.id,
        newValues: { toUserId: user.id, sent },
        ...req.auditMeta,
      });

      res.json({ sent });
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
      prisma.smsLog.findMany({
        where: { organizationId: req.user!.organizationId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
          ticket: { select: { id: true, ticketNumber: true, title: true } },
        },
      }),
      prisma.smsLog.count({ where: { organizationId: req.user!.organizationId } }),
    ]);

    res.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (e) {
    next(e);
  }
});

router.get('/logs/:id', [param('id').notEmpty()], async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const log = await prisma.smsLog.findFirst({
      where: { id: req.params.id, organizationId: req.user!.organizationId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        ticket: { select: { id: true, ticketNumber: true, title: true } },
      },
    });
    if (!log) { next(new AppError(404, 'SMS log not found')); return; }
    res.json(log);
  } catch (e) {
    next(e);
  }
});

export default router;
