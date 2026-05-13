import { Router, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { AuditAction, Permission } from '@prisma/client';
import { AuthRequest } from '../types';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { AppError } from '../middleware/errorHandler';
import prisma from '../config/database';
import { writeAudit } from '../services/auditService';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission(Permission.LOCATION_READ), async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const locations = await prisma.location.findMany({
      where: { active: true },
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { children: true, assets: true, tickets: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json(locations);
  } catch (e) { next(e); }
});

router.get('/tree', requirePermission(Permission.LOCATION_READ), async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const all = await prisma.location.findMany({
      where: { active: true },
      include: { children: { where: { active: true } } },
    });
    const roots = all.filter((l) => !l.parentId);
    res.json(roots);
  } catch (e) { next(e); }
});

router.post(
  '/',
  requirePermission(Permission.LOCATION_CREATE),
  [body('name').trim().notEmpty().isLength({ max: 100 })],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { next(new AppError(400, errors.array()[0].msg as string)); return; }
    try {
      const location = await prisma.location.create({
        data: {
          name: req.body.name,
          code: req.body.code,
          description: req.body.description,
          address: req.body.address,
          parentId: req.body.parentId || null,
        },
      });
      await writeAudit({ userId: req.user!.id, action: AuditAction.CREATE, resource: 'locations', resourceId: location.id, ...req.auditMeta });
      res.status(201).json(location);
    } catch (e) { next(e); }
  }
);

router.patch(
  '/:id',
  requirePermission(Permission.LOCATION_UPDATE),
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const location = await prisma.location.update({
        where: { id: req.params.id },
        data: {
          name: req.body.name,
          code: req.body.code,
          description: req.body.description,
          address: req.body.address,
          parentId: req.body.parentId,
          active: req.body.active,
        },
      });
      await writeAudit({ userId: req.user!.id, action: AuditAction.UPDATE, resource: 'locations', resourceId: req.params.id, ...req.auditMeta });
      res.json(location);
    } catch (e) { next(e); }
  }
);

export default router;
