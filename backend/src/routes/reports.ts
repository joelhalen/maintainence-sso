import { Router, Response, NextFunction } from 'express';
import { Permission, TicketStatus } from '@prisma/client';
import { AuthRequest } from '../types';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import prisma from '../config/database';

const router = Router();
router.use(authenticate, requirePermission(Permission.REPORT_VIEW));

router.get('/summary', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const [statusCounts, priorityCounts, openByLocation, overdueCount, avgResolutionMs] = await Promise.all([
      prisma.ticket.groupBy({ by: ['status'], _count: true, where: { organizationId: req.user!.organizationId } }),
      prisma.ticket.groupBy({ by: ['priority'], _count: true, where: { organizationId: req.user!.organizationId, status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] } } }),
      prisma.ticket.groupBy({
        by: ['locationId'],
        _count: true,
        where: { organizationId: req.user!.organizationId, status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] } },
        orderBy: { _count: { locationId: 'desc' } },
        take: 10,
      }),
      prisma.ticket.count({
        where: {
          status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] },
          organizationId: req.user!.organizationId,
          dueDate: { lt: new Date() },
        },
      }),
      prisma.ticket.aggregate({
        _avg: { actualHours: true },
        where: { organizationId: req.user!.organizationId, status: TicketStatus.COMPLETED, completedAt: { not: null } },
      }),
    ]);

    res.json({ statusCounts, priorityCounts, openByLocation, overdueCount, avgActualHours: avgResolutionMs._avg.actualHours });
  } catch (e) { next(e); }
});

router.get('/audit', requirePermission(Permission.AUDIT_LOG_VIEW), async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || '1'));
    const limit = Math.min(100, parseInt((req.query.limit as string) || '50'));
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { organizationId: req.user!.organizationId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      prisma.auditLog.count({ where: { organizationId: req.user!.organizationId } }),
    ]);
    res.json({ data: logs, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (e) { next(e); }
});

export default router;
