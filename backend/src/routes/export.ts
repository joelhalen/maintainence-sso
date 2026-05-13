import { Router, Response, NextFunction } from 'express';
import { Permission, TicketStatus, TicketPriority } from '@prisma/client';
import { AuthRequest } from '../types';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import prisma from '../config/database';

const router = Router();
router.use(authenticate, requirePermission(Permission.TICKET_EXPORT));

function escapeCsv(val: unknown): string {
  const str = val == null ? '' : String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowToCsv(fields: unknown[]): string {
  return fields.map(escapeCsv).join(',');
}

router.get(
  '/tickets',
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const where: Record<string, unknown> = {};
      if (req.query.status) where.status = req.query.status;
      if (req.query.priority) where.priority = req.query.priority;
      if (req.query.locationId) where.locationId = req.query.locationId;
      if (req.query.from || req.query.to) {
        where.createdAt = {};
        if (req.query.from) (where.createdAt as Record<string, unknown>).gte = new Date(req.query.from as string);
        if (req.query.to) (where.createdAt as Record<string, unknown>).lte = new Date(req.query.to as string);
      }

      const tickets = await prisma.ticket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 10000,
        include: {
          location: { select: { name: true } },
          asset: { select: { name: true, assetTag: true } },
          createdBy: { select: { name: true, email: true } },
          assignedTo: { select: { name: true } },
          completedBy: { select: { name: true } },
        },
      });

      const headers = [
        'Ticket #', 'Title', 'Type', 'Status', 'Priority',
        'Location', 'Asset', 'Asset Tag',
        'Created By', 'Assigned To', 'Completed By',
        'Due Date', 'Started At', 'Completed At',
        'Est. Hours', 'Actual Hours',
        'Tags', 'Created At', 'Updated At',
      ];

      const rows = tickets.map((t) => rowToCsv([
        t.ticketNumber, t.title, t.type, t.status, t.priority,
        t.location.name, t.asset?.name ?? '', t.asset?.assetTag ?? '',
        t.createdBy.name, t.assignedTo?.name ?? '', t.completedBy?.name ?? '',
        t.dueDate?.toISOString() ?? '', t.startedAt?.toISOString() ?? '', t.completedAt?.toISOString() ?? '',
        t.estimatedHours?.toString() ?? '', t.actualHours?.toString() ?? '',
        t.tags.join(';'), t.createdAt.toISOString(), t.updatedAt.toISOString(),
      ]));

      const csv = [rowToCsv(headers), ...rows].join('\n');
      const filename = `megamtx-tickets-${new Date().toISOString().slice(0, 10)}.csv`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (e) {
      next(e);
    }
  }
);

export default router;
