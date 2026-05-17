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

// GET /api/groups — list all groups with member/rule counts
router.get('/', async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const groups = await prisma.group.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { members: true, rules: true } },
      },
    });
    res.json(groups);
  } catch (e) { next(e); }
});

// POST /api/groups — create group
router.post(
  '/',
  [body('name').trim().notEmpty(), body('color').optional().matches(/^#[0-9a-fA-F]{6}$/)],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { next(new AppError(400, errors.array()[0].msg as string)); return; }
    try {
      const group = await prisma.group.create({
        data: { name: req.body.name, description: req.body.description, color: req.body.color },
      });
      res.status(201).json(group);
    } catch (e) { next(e); }
  }
);

// GET /api/groups/:id — group detail with members and rules
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const group = await prisma.group.findUnique({
      where: { id: req.params.id },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true, role: { select: { name: true } }, department: true, active: true } } },
          orderBy: { addedAt: 'asc' },
        },
        rules: {
          include: { location: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!group) { next(new AppError(404, 'Group not found')); return; }
    res.json(group);
  } catch (e) { next(e); }
});

// PATCH /api/groups/:id — update name / description / color
router.patch(
  '/:id',
  [body('name').optional().trim().notEmpty()],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const group = await prisma.group.update({
        where: { id: req.params.id },
        data: {
          name: req.body.name,
          description: req.body.description,
          color: req.body.color,
        },
      });
      res.json(group);
    } catch (e) { next(e); }
  }
);

// DELETE /api/groups/:id
router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    await prisma.group.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (e) { next(e); }
});

// POST /api/groups/:id/members — add a user to the group
router.post(
  '/:id/members',
  [body('userId').notEmpty()],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { next(new AppError(400, errors.array()[0].msg as string)); return; }
    try {
      const membership = await prisma.groupMembership.create({
        data: { groupId: req.params.id, userId: req.body.userId },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
      res.status(201).json(membership);
    } catch (e: unknown) {
      if ((e as { code?: string }).code === 'P2002') {
        next(new AppError(409, 'User is already a member of this group'));
      } else { next(e); }
    }
  }
);

// DELETE /api/groups/:id/members/:userId — remove a user from the group
router.delete('/:id/members/:userId', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    await prisma.groupMembership.deleteMany({
      where: { groupId: req.params.id, userId: req.params.userId },
    });
    res.status(204).send();
  } catch (e) { next(e); }
});

// POST /api/groups/:id/rules — add a permission rule to this group
router.post(
  '/:id/rules',
  [
    body('action').isIn(Object.values(RuleAction)),
    body('effect').optional().isIn(Object.values(RuleEffect)),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { next(new AppError(400, errors.array()[0].msg as string)); return; }
    try {
      const rule = await prisma.permissionRule.create({
        data: {
          groupId: req.params.id,
          locationId: req.body.locationId || null,
          ticketType: req.body.ticketType as TicketType | undefined || null,
          action: req.body.action as RuleAction,
          effect: (req.body.effect as RuleEffect) ?? RuleEffect.ALLOW,
        },
        include: { location: { select: { id: true, name: true } } },
      });
      res.status(201).json(rule);
    } catch (e) { next(e); }
  }
);

// DELETE /api/groups/:id/rules/:ruleId
router.delete('/:id/rules/:ruleId', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    await prisma.permissionRule.deleteMany({
      where: { id: req.params.ruleId, groupId: req.params.id },
    });
    res.status(204).send();
  } catch (e) { next(e); }
});

export default router;
