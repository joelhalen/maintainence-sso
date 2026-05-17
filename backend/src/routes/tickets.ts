import { Router, Response, NextFunction } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { TicketType, TicketPriority, TicketStatus, AuditAction, Permission } from '@prisma/client';
import { AuthRequest } from '../types';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { AppError } from '../middleware/errorHandler';
import prisma from '../config/database';
import { listTickets, createTicket, updateTicketStatus } from '../services/ticketService';
import { writeAudit } from '../services/auditService';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission(Permission.TICKET_READ), async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await listTickets(req.query as Record<string, string>, req.user!);
    res.json(result);
  } catch (e) { next(e); }
});

router.post(
  '/',
  requirePermission(Permission.TICKET_CREATE),
  [
    body('title').trim().notEmpty().isLength({ max: 200 }),
    body('description').trim().notEmpty(),
    body('type').isIn(Object.values(TicketType)),
    body('priority').isIn(Object.values(TicketPriority)),
    body('locationId').notEmpty(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { next(new AppError(400, errors.array()[0].msg as string)); return; }
    try {
      const ticket = await createTicket(req.body, req.user!, req.auditMeta!);
      res.status(201).json(ticket);
    } catch (e) { next(e); }
  }
);

router.get('/:id', requirePermission(Permission.TICKET_READ), async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const ticket = await prisma.ticket.findFirst({
      where: { id: req.params.id, organizationId: req.user!.organizationId },
      include: {
        location: true,
        asset: { include: { category: true, location: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        completedBy: { select: { id: true, name: true, email: true } },
        closedBy: { select: { id: true, name: true, email: true } },
        comments: {
          include: { author: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        },
        attachments: true,
        statusHistory: {
          include: { changedBy: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        },
        signatures: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });
    if (!ticket) { next(new AppError(404, 'Ticket not found')); return; }
    res.json(ticket);
  } catch (e) { next(e); }
});

router.patch(
  '/:id',
  requirePermission(Permission.TICKET_UPDATE),
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const old = await prisma.ticket.findFirst({ where: { id: req.params.id, organizationId: req.user!.organizationId } });
      if (!old) { next(new AppError(404, 'Ticket not found')); return; }

      const allowed = ['title', 'description', 'priority', 'type', 'dueDate', 'estimatedHours', 'tags', 'assetId', 'assignedToId'];
      const data: Record<string, unknown> = {};
      for (const key of allowed) {
        if (req.body[key] !== undefined) data[key] = req.body[key];
      }

      if (data.assetId) {
        const asset = await prisma.asset.findFirst({ where: { id: String(data.assetId), organizationId: req.user!.organizationId } });
        if (!asset) { next(new AppError(400, 'Asset is not available for this organization')); return; }
      }
      if (data.assignedToId) {
        const assignee = await prisma.user.findFirst({ where: { id: String(data.assignedToId), organizationId: req.user!.organizationId } });
        if (!assignee) { next(new AppError(400, 'Assignee is not available for this organization')); return; }
      }

      const updated = await prisma.ticket.update({ where: { id: old.id }, data });

      await writeAudit({
        organizationId: req.user!.organizationId,
        userId: req.user!.id,
        action: AuditAction.UPDATE,
        resource: 'tickets',
        resourceId: req.params.id,
        oldValues: old as Record<string, unknown>,
        newValues: data,
        ...req.auditMeta,
      });

      res.json(updated);
    } catch (e) { next(e); }
  }
);

router.patch(
  '/:id/status',
  requirePermission(Permission.TICKET_UPDATE),
  [body('status').isIn(Object.values(TicketStatus))],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { next(new AppError(400, 'Invalid status')); return; }
    try {
      const updated = await updateTicketStatus(
        req.params.id, req.body.status, req.user!, req.auditMeta!,
        req.body.reason, req.body.resolutionNotes
      );
      res.json(updated);
    } catch (e) { next(e); }
  }
);

router.post(
  '/:id/comments',
  requirePermission(Permission.TICKET_READ),
  [body('content').trim().notEmpty()],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { next(new AppError(400, 'Comment content required')); return; }
    try {
      const ticket = await prisma.ticket.findFirst({
        where: { id: req.params.id, organizationId: req.user!.organizationId },
      });
      if (!ticket) { next(new AppError(404, 'Ticket not found')); return; }

      const comment = await prisma.ticketComment.create({
        data: {
          organizationId: req.user!.organizationId,
          ticketId: req.params.id,
          authorId: req.user!.id,
          content: req.body.content,
          isInternal: req.body.isInternal || false,
        },
        include: { author: { select: { id: true, name: true } } },
      });
      res.status(201).json(comment);
    } catch (e) { next(e); }
  }
);

router.delete(
  '/:id',
  requirePermission(Permission.TICKET_DELETE),
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ticket = await prisma.ticket.findFirst({
        where: { id: req.params.id, organizationId: req.user!.organizationId },
      });
      if (!ticket) { next(new AppError(404, 'Ticket not found')); return; }

      await prisma.ticket.delete({ where: { id: ticket.id } });
      await writeAudit({
        organizationId: req.user!.organizationId,
        userId: req.user!.id,
        action: AuditAction.DELETE,
        resource: 'tickets',
        resourceId: req.params.id,
        ...req.auditMeta,
      });
      res.status(204).send();
    } catch (e) { next(e); }
  }
);

export default router;
