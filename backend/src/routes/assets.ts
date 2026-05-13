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

router.get('/', requirePermission(Permission.ASSET_READ), async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { locationId, categoryId, search } = req.query as Record<string, string>;
    const where: Record<string, unknown> = { active: true };
    if (locationId) where.locationId = locationId;
    if (categoryId) where.categoryId = categoryId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { assetTag: { contains: search, mode: 'insensitive' } },
        { serialNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const assets = await prisma.asset.findMany({
      where,
      include: {
        category: true,
        location: { select: { id: true, name: true } },
        _count: { select: { tickets: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json(assets);
  } catch (e) { next(e); }
});

router.post(
  '/',
  requirePermission(Permission.ASSET_CREATE),
  [body('name').trim().notEmpty(), body('categoryId').notEmpty(), body('locationId').notEmpty()],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { next(new AppError(400, errors.array()[0].msg as string)); return; }
    try {
      const asset = await prisma.asset.create({ data: req.body });
      await writeAudit({ userId: req.user!.id, action: AuditAction.CREATE, resource: 'assets', resourceId: asset.id, ...req.auditMeta });
      res.status(201).json(asset);
    } catch (e) { next(e); }
  }
);

router.get('/:id', requirePermission(Permission.ASSET_READ), async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const asset = await prisma.asset.findUnique({
      where: { id: req.params.id },
      include: {
        category: true,
        location: true,
        tickets: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: { assignedTo: { select: { name: true } } },
        },
      },
    });
    if (!asset) { next(new AppError(404, 'Asset not found')); return; }
    res.json(asset);
  } catch (e) { next(e); }
});

router.patch(
  '/:id',
  requirePermission(Permission.ASSET_UPDATE),
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const asset = await prisma.asset.update({ where: { id: req.params.id }, data: req.body });
      await writeAudit({ userId: req.user!.id, action: AuditAction.UPDATE, resource: 'assets', resourceId: req.params.id, ...req.auditMeta });
      res.json(asset);
    } catch (e) { next(e); }
  }
);

router.get('/categories', requirePermission(Permission.ASSET_READ), async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const categories = await prisma.assetCategory.findMany({ orderBy: { name: 'asc' } });
    res.json(categories);
  } catch (e) { next(e); }
});

export default router;
