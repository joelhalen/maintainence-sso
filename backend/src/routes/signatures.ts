import { Router, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Permission, AuditAction } from '@prisma/client';
import { AuthRequest } from '../types';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { AppError } from '../middleware/errorHandler';
import { writeAudit } from '../services/auditService';
import prisma from '../config/database';

const router = Router();
router.use(authenticate);

/**
 * Apply an electronic signature to a ticket (21 CFR Part 11).
 * Requires the user to re-enter their password to confirm identity.
 */
router.post(
  '/tickets/:ticketId',
  requirePermission(Permission.TICKET_UPDATE),
  [
    body('password').notEmpty().withMessage('Password is required to apply electronic signature'),
    body('meaning').trim().notEmpty().withMessage('Signature meaning is required (e.g. "Approved", "Reviewed", "Completed by")'),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      next(new AppError(400, errors.array()[0].msg as string));
      return;
    }

    try {
      const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
      if (!user || !user.passwordHash) {
        next(new AppError(400, 'Electronic signature requires a local password'));
        return;
      }

      const valid = await bcrypt.compare(req.body.password, user.passwordHash);
      if (!valid) {
        await writeAudit({
          userId: req.user!.id,
          action: AuditAction.LOGIN_FAILED,
          resource: 'signatures',
          resourceId: req.params.ticketId,
          notes: 'Invalid password for electronic signature',
          ...req.auditMeta,
        });
        next(new AppError(401, 'Invalid password — electronic signature rejected'));
        return;
      }

      const ticket = await prisma.ticket.findUnique({ where: { id: req.params.ticketId } });
      if (!ticket) {
        next(new AppError(404, 'Ticket not found'));
        return;
      }

      // Generate a deterministic hash of the signature event for integrity
      const hash = crypto
        .createHash('sha256')
        .update(`${req.user!.id}:${ticket.id}:${req.body.meaning}:${Date.now()}`)
        .digest('hex');

      const signature = await prisma.electronicSignature.create({
        data: {
          ticketId: ticket.id,
          userId: req.user!.id,
          meaning: req.body.meaning,
          hash,
          ipAddress: req.auditMeta?.ipAddress,
        },
        include: { user: { select: { id: true, name: true, email: true } } },
      });

      await writeAudit({
        userId: req.user!.id,
        action: AuditAction.SIGN,
        resource: 'tickets',
        resourceId: ticket.id,
        newValues: { meaning: req.body.meaning, hash },
        ...req.auditMeta,
      });

      res.status(201).json(signature);
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  '/tickets/:ticketId',
  requirePermission(Permission.TICKET_READ),
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const signatures = await prisma.electronicSignature.findMany({
        where: { ticketId: req.params.ticketId },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { signedAt: 'asc' },
      });
      res.json(signatures);
    } catch (e) {
      next(e);
    }
  }
);

export default router;
