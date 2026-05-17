import { Router, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import { AuditAction, Permission } from '@prisma/client';
import { AuthRequest } from '../types';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { AppError } from '../middleware/errorHandler';
import prisma from '../config/database';
import { writeAudit } from '../services/auditService';
import { assertWithinLimit } from '../services/entitlementService';

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

router.post(
  '/',
  requirePermission(Permission.USER_CREATE),
  [
    body('email').isEmail().normalizeEmail(),
    body('name').trim().notEmpty(),
    body('roleId').notEmpty(),
    body('password').optional().isLength({ min: 8 }),
    body('phone').optional({ nullable: true, checkFalsy: true }).matches(/^\+[1-9]\d{7,14}$/).withMessage('Phone must be in E.164 format, e.g. +15558675310'),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { next(new AppError(400, errors.array()[0].msg as string)); return; }
    try {
      await assertWithinLimit(req.user!.organization, 'users');
      const role = await prisma.role.findFirst({
        where: { id: req.body.roleId, organizationId: req.user!.organizationId },
      });
      if (!role) { next(new AppError(400, 'Role is not available for this organization')); return; }

      const passwordHash = req.body.password ? await bcrypt.hash(req.body.password, 12) : undefined;
      const user = await prisma.user.create({
        data: {
          email: req.body.email,
          name: req.body.name,
          roleId: req.body.roleId,
          organizationId: req.user!.organizationId,
          department: req.body.department,
          phone: req.body.phone,
          passwordHash,
          notificationPref: { create: {} },
        },
        include: { role: true },
      });
      await writeAudit({ organizationId: req.user!.organizationId, userId: req.user!.id, action: AuditAction.CREATE, resource: 'users', resourceId: user.id, ...req.auditMeta });
      const { passwordHash: _, ...safeUser } = user;
      res.status(201).json(safeUser);
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
    body('smsEnabled').optional().isBoolean(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { next(new AppError(400, errors.array()[0].msg as string)); return; }

    try {
      const allowed = ['onAssign', 'onComment', 'onStatusChange', 'onDueDateRemind', 'emailEnabled', 'smsEnabled'];
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
    body('phone').optional({ nullable: true, checkFalsy: true }).matches(/^\+[1-9]\d{7,14}$/).withMessage('Phone must be in E.164 format, e.g. +15558675310'),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { next(new AppError(400, errors.array()[0].msg as string)); return; }

    try {
      const old = await prisma.user.findFirst({ where: { id: req.params.id, organizationId: req.user!.organizationId } });
      if (!old) { next(new AppError(404, 'User not found')); return; }

      const data: Record<string, unknown> = {};
      const allowed = ['name', 'department', 'phone', 'active', 'roleId'];
      for (const k of allowed) { if (req.body[k] !== undefined) data[k] = req.body[k]; }
      if (data.phone !== undefined && data.phone !== old.phone) data.phoneVerifiedAt = null;

      if (data.roleId) {
        const role = await prisma.role.findFirst({ where: { id: String(data.roleId), organizationId: req.user!.organizationId } });
        if (!role) { next(new AppError(400, 'Role is not available for this organization')); return; }
        await writeAudit({ organizationId: req.user!.organizationId, userId: req.user!.id, action: AuditAction.ROLE_CHANGE, resource: 'users', resourceId: req.params.id, newValues: { roleId: data.roleId }, ...req.auditMeta });
      }

      const user = await prisma.user.update({
        where: { id: old.id },
        data,
        include: { role: true },
      });
      await writeAudit({
        organizationId: req.user!.organizationId,
        userId: req.user!.id,
        action: AuditAction.UPDATE,
        resource: 'users',
        resourceId: user.id,
        oldValues: { name: old.name, department: old.department, phone: old.phone, active: old.active, roleId: old.roleId },
        newValues: data,
        ...req.auditMeta,
      });
      const { passwordHash: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (e) { next(e); }
  }
);

router.get('/roles', requirePermission(Permission.USER_READ), async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const roles = await prisma.role.findMany({
      where: { organizationId: req.user!.organizationId },
      orderBy: { name: 'asc' },
    });
    res.json(roles);
  } catch (e) { next(e); }
});

export default router;
