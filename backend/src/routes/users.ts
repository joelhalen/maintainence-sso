import { Router, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import { AuditAction, Permission } from '@prisma/client';
import { AuthRequest } from '../types';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { AppError } from '../middleware/errorHandler';
import prisma from '../config/database';
import { writeAudit } from '../services/auditService';
import { createOrganizationUser, updateOrganizationUser } from '../services/userService';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission(Permission.USER_READ), async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      where: { organizationId: req.user!.organizationId },
      include: { role: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(users.map(({ passwordHash, ...u }) => u));
  } catch (e) { next(e); }
});

router.get('/roles', requirePermission(Permission.USER_READ), async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const roles = await prisma.role.findMany({
      where: { organizationId: req.user!.organizationId },
      orderBy: { name: 'asc' },
    });
    res.json(roles);
  } catch (e) { next(e); }
});

router.get(
  '/:id',
  requirePermission(Permission.USER_READ),
  [param('id').notEmpty()],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await prisma.user.findFirst({
        where: { id: req.params.id, organizationId: req.user!.organizationId },
        include: { role: { select: { id: true, name: true, description: true } } },
      });
      if (!user) { next(new AppError(404, 'User not found')); return; }
      const { passwordHash, ...safeUser } = user;
      res.json(safeUser);
    } catch (e) { next(e); }
  }
);

router.post(
  '/',
  requirePermission(Permission.USER_CREATE),
  [
    body('email').isEmail().normalizeEmail(),
    body('name').trim().notEmpty(),
    body('roleId').notEmpty(),
    body('password').isLength({ min: 8 }),
    body('department').optional().trim(),
    body('active').optional().isBoolean(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { next(new AppError(400, errors.array()[0].msg as string)); return; }
    try {
      const user = await createOrganizationUser({
        organizationId: req.user!.organizationId,
        email: req.body.email,
        name: req.body.name,
        roleId: req.body.roleId,
        password: req.body.password,
        department: req.body.department,
        active: req.body.active,
        auditUserId: req.user!.id,
        auditMeta: req.auditMeta,
      });
      res.status(201).json(user);
    } catch (e) { next(e); }
  }
);

router.patch(
  '/notification-preferences',
  [
    body('onAssign').optional().isBoolean(),
    body('onComment').optional().isBoolean(),
    body('onStatusChange').optional().isBoolean(),
    body('onDueDateRemind').optional().isBoolean(),
    body('emailEnabled').optional().isBoolean(),
    body('pushEnabled').optional().isBoolean(),
    body('onAssignPush').optional().isBoolean(),
    body('onStatusPush').optional().isBoolean(),
    body('onCommentPush').optional().isBoolean(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { next(new AppError(400, errors.array()[0].msg as string)); return; }

    try {
      const allowed = ['onAssign', 'onComment', 'onStatusChange', 'onDueDateRemind', 'emailEnabled', 'pushEnabled', 'onAssignPush', 'onStatusPush', 'onCommentPush'];
      const data: Record<string, boolean> = {};
      for (const key of allowed) {
        if (req.body[key] !== undefined) data[key] = req.body[key] === true || req.body[key] === 'true';
      }

      const prefs = await prisma.notificationPreference.upsert({
        where: { userId: req.user!.id },
        update: data,
        create: { userId: req.user!.id, ...data },
      });

      await writeAudit({
        userId: req.user!.id,
        action: AuditAction.UPDATE,
        resource: 'notification_preferences',
        resourceId: prefs.id,
        newValues: data,
        ...req.auditMeta,
      });

      res.json(prefs);
    } catch (e) { next(e); }
  }
);

router.patch(
  '/:id',
  requirePermission(Permission.USER_UPDATE),
  [
    body('email').optional().isEmail().normalizeEmail(),
    body('name').optional().trim().notEmpty(),
    body('roleId').optional().notEmpty(),
    body('password').optional().isLength({ min: 8 }),
    body('department').optional().trim(),
    body('active').optional().isBoolean(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { next(new AppError(400, errors.array()[0].msg as string)); return; }
    try {
      const user = await updateOrganizationUser({
        organizationId: req.user!.organizationId,
        userId: req.params.id,
        name: req.body.name,
        email: req.body.email,
        roleId: req.body.roleId,
        department: req.body.department,
        active: req.body.active,
        password: req.body.password,
        auditUserId: req.user!.id,
        auditMeta: req.auditMeta,
      });
      res.json(user);
    } catch (e) { next(e); }
  }
);

export default router;
