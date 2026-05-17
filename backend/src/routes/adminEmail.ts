import { Router, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { body, param, query, validationResult } from 'express-validator';
import { AuditAction, EmailDirection, EmailMessageStatus, Permission } from '@prisma/client';
import { AuthRequest } from '../types';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { AppError } from '../middleware/errorHandler';
import prisma from '../config/database';
import { emailTransport, getEmailConfigStatus } from '../config/email';
import { getImapConfigStatus, isImapConfigured, verifyImapConnection } from '../config/imap';
import { sendEmail } from '../services/emailService';
import { pollEmailInbox } from '../workers/emailInboxWorker';
import { writeAudit } from '../services/auditService';

const router = Router();
const testSendLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });

router.use(authenticate, requirePermission(Permission.EMAIL_SETTINGS));

router.get('/config-status', async (_req: AuthRequest, res: Response): Promise<void> => {
  res.json({
    smtp: getEmailConfigStatus(),
    imap: getImapConfigStatus(),
  });
});

router.post('/smtp/verify', async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    await emailTransport.verify();
    res.json({ ok: true });
  } catch (error) {
    next(new AppError(502, error instanceof Error ? error.message : 'SMTP verification failed'));
  }
});

router.post(
  '/test',
  testSendLimiter,
  [
    body('to').isEmail().normalizeEmail(),
    body('subject').optional().trim().isLength({ max: 200 }),
    body('body').optional().trim().isLength({ max: 5000 }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { next(new AppError(400, errors.array()[0].msg as string)); return; }

    try {
      const subject = req.body.subject || 'MegaMTX email test';
      const text = req.body.body || 'This is a MegaMTX test email from the super-admin email settings page.';
      const sent = await sendEmail({
        organizationId: req.user!.organizationId,
        to: req.body.to,
        subject,
        text,
        html: `<p>${escapeHtml(text)}</p>`,
        templateName: 'admin_test',
      });

      await writeAudit({
        organizationId: req.user!.organizationId,
        userId: req.user!.id,
        action: AuditAction.CREATE,
        resource: 'email_test',
        newValues: { to: req.body.to, sent },
        ...req.auditMeta,
      });

      res.json({ sent });
    } catch (e) { next(e); }
  }
);

router.get('/logs', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || '1'));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '25')));
    const status = req.query.status as string | undefined;
    const recipient = req.query.recipient as string | undefined;
    const search = req.query.search as string | undefined;

    const where: Record<string, unknown> = { organizationId: req.user!.organizationId };
    if (status) where.status = status;
    if (recipient) where.to = { has: recipient };
    if (search) where.OR = [
      { subject: { contains: search, mode: 'insensitive' } },
      { errorMessage: { contains: search, mode: 'insensitive' } },
    ];

    const [data, total] = await Promise.all([
      prisma.emailLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { ticket: { select: { id: true, ticketNumber: true, title: true } } },
      }),
      prisma.emailLog.count({ where }),
    ]);

    res.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (e) { next(e); }
});

router.get('/logs/:id', [param('id').notEmpty()], async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const log = await prisma.emailLog.findFirst({
      where: { id: req.params.id, organizationId: req.user!.organizationId },
      include: { ticket: { select: { id: true, ticketNumber: true, title: true } } },
    });
    if (!log) { next(new AppError(404, 'Email log not found')); return; }
    res.json(log);
  } catch (e) { next(e); }
});

router.post('/imap/verify', async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  if (!isImapConfigured()) {
    next(new AppError(400, 'IMAP is not configured'));
    return;
  }
  try {
    await verifyImapConnection();
    res.json({ ok: true });
  } catch (error) {
    next(new AppError(502, error instanceof Error ? error.message : 'IMAP verification failed'));
  }
});

router.post('/poll-now', async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await pollEmailInbox();
    res.json(result);
  } catch (e) { next(e); }
});

router.get('/messages', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || '1'));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '25')));
    const direction = req.query.direction as EmailDirection | undefined;
    const status = req.query.status as EmailMessageStatus | undefined;
    const search = req.query.search as string | undefined;

    const where: Record<string, unknown> = { organizationId: req.user!.organizationId };
    if (direction) where.direction = direction;
    if (status) where.status = status;
    if (search) where.OR = [
      { subject: { contains: search, mode: 'insensitive' } },
      { from: { contains: search, mode: 'insensitive' } },
      { textBody: { contains: search, mode: 'insensitive' } },
    ];

    const [data, total] = await Promise.all([
      prisma.emailMessage.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ receivedAt: 'desc' }, { createdAt: 'desc' }],
        include: {
          ticket: { select: { id: true, ticketNumber: true, title: true } },
          user: { select: { id: true, name: true, email: true } },
          _count: { select: { attachments: true } },
        },
      }),
      prisma.emailMessage.count({ where }),
    ]);

    res.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (e) { next(e); }
});

router.get('/messages/:id', [param('id').notEmpty()], async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const message = await prisma.emailMessage.findFirst({
      where: { id: req.params.id, organizationId: req.user!.organizationId },
      include: {
        ticket: { select: { id: true, ticketNumber: true, title: true } },
        user: { select: { id: true, name: true, email: true } },
        attachments: true,
      },
    });
    if (!message) { next(new AppError(404, 'Email message not found')); return; }
    res.json(message);
  } catch (e) { next(e); }
});

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default router;
