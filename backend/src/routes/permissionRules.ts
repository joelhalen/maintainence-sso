import { Router, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { Permission, RuleAction, RuleEffect, TicketType } from '@prisma/client';
import { AuthRequest } from '../types';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { AppError } from '../middleware/errorHandler';
import prisma from '../config/database';

const router = Router();
router.use(authenticate, requirePermission(Permission.GROUP_MANAGE));

// GET /api/permission-rules?userId=&groupId=
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId, groupId } = req.query as Record<string, string>;
    if (!userId && !groupId) { next(new AppError(400, 'Provide userId or groupId filter')); return; }

    const rules = await prisma.permissionRule.findMany({
      where: {
        ...(userId ? { userId } : {}),
        ...(groupId ? { groupId } : {}),
      },
      include: {
        location: { select: { id: true, name: true } },
        user:     { select: { id: true, name: true, email: true } },
        group:    { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(rules);
  } catch (e) { next(e); }
});

// POST /api/permission-rules — create a direct user or group rule
router.post(
  '/',
  [
    body('action').isIn(Object.values(RuleAction)),
    body('effect').optional().isIn(Object.values(RuleEffect)),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { next(new AppError(400, errors.array()[0].msg as string)); return; }

    const { userId, groupId, locationId, ticketType, action, effect } = req.body;
    if (!userId && !groupId) { next(new AppError(400, 'Provide userId or groupId')); return; }
    if (userId && groupId)  { next(new AppError(400, 'Provide either userId or groupId, not both')); return; }

    try {
      const rule = await prisma.permissionRule.create({
        data: {
          userId:    userId    ?? null,
          groupId:   groupId   ?? null,
          locationId: locationId ?? null,
          ticketType: ticketType as TicketType | undefined ?? null,
          action: action as RuleAction,
          effect: (effect as RuleEffect) ?? RuleEffect.ALLOW,
        },
        include: {
          location: { select: { id: true, name: true } },
          user:     { select: { id: true, name: true } },
          group:    { select: { id: true, name: true } },
        },
      });
      res.status(201).json(rule);
    } catch (e) { next(e); }
  }
);

// DELETE /api/permission-rules/:id
router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    await prisma.permissionRule.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (e) { next(e); }
});

export default router;
