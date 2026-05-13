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

const router = Router();
router.use(authenticate);

router.get('/', requirePermission(Permission.USER_READ), async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
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
  ],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { next(new AppError(400, errors.array()[0].msg as string)); return; }
    try {
      const passwordHash = req.body.password ? await bcrypt.hash(req.body.password, 12) : undefined;
      const user = await prisma.user.create({
        data: {
          email: req.body.email,
          name: req.body.name,
          roleId: req.body.roleId,
          department: req.body.department,
          phone: req.body.phone,
          passwordHash,
        },
        include: { role: true },
      });
      await writeAudit({ userId: req.user!.id, action: AuditAction.CREATE, resource: 'users', resourceId: user.id, ...req.auditMeta });
      const { passwordHash: _, ...safeUser } = user;
      res.status(201).json(safeUser);
    } catch (e) { next(e); }
  }
);

router.patch(
  '/:id',
  requirePermission(Permission.USER_UPDATE),
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data: Record<string, unknown> = {};
      const allowed = ['name', 'department', 'phone', 'active', 'roleId'];
      for (const k of allowed) { if (req.body[k] !== undefined) data[k] = req.body[k]; }

      if (data.roleId) {
        await writeAudit({ userId: req.user!.id, action: AuditAction.ROLE_CHANGE, resource: 'users', resourceId: req.params.id, newValues: { roleId: data.roleId }, ...req.auditMeta });
      }

      const user = await prisma.user.update({
        where: { id: req.params.id },
        data,
        include: { role: true },
      });
      const { passwordHash: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (e) { next(e); }
  }
);

router.get('/roles', requirePermission(Permission.USER_READ), async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const roles = await prisma.role.findMany({ orderBy: { name: 'asc' } });
    res.json(roles);
  } catch (e) { next(e); }
});

export default router;
