import { Router, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { AuditAction } from '@prisma/client';
import { AuthRequest } from '../types';
import { authenticate } from '../middleware/auth';
import { requirePlatformAdmin } from '../middleware/rbac';
import { AppError } from '../middleware/errorHandler';
import { writeAudit } from '../services/auditService';
import {
  getMobileReleaseAdminView,
  readMobileReleaseConfig,
  startMobileApkBuild,
  writeMobileReleaseConfig,
  type MobileReleaseConfig,
} from '../services/mobileReleaseService';

const router = Router();
router.use(authenticate, requirePlatformAdmin);

router.get('/', async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.json(await getMobileReleaseAdminView());
  } catch (e) {
    next(e);
  }
});

router.patch(
  '/',
  [
    body('versionName').optional().trim().notEmpty(),
    body('versionCode').optional().isInt({ min: 1 }),
    body('minVersionCode').optional().isInt({ min: 1 }),
    body('apkUrl').optional().trim().isURL({ require_protocol: true }),
    body('playStoreUrl').optional({ nullable: true }).trim(),
    body('appStoreUrl').optional({ nullable: true }).trim(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      next(new AppError(400, errors.array()[0].msg as string));
      return;
    }

    try {
      const current = await readMobileReleaseConfig();
      const updated: MobileReleaseConfig = {
        versionName: req.body.versionName ?? current.versionName,
        versionCode: req.body.versionCode ?? current.versionCode,
        minVersionCode: req.body.minVersionCode ?? current.minVersionCode,
        apkUrl: req.body.apkUrl ?? current.apkUrl,
        playStoreUrl: req.body.playStoreUrl !== undefined
          ? (req.body.playStoreUrl || null)
          : current.playStoreUrl,
        appStoreUrl: req.body.appStoreUrl !== undefined
          ? (req.body.appStoreUrl || null)
          : current.appStoreUrl,
      };

      await writeMobileReleaseConfig(updated);

      await writeAudit({
        userId: req.user!.id,
        action: AuditAction.UPDATE,
        resource: 'mobile_release',
        resourceId: 'config',
        newValues: { ...updated },
        ...req.auditMeta,
      });

      res.json(await getMobileReleaseAdminView());
    } catch (e) {
      next(e);
    }
  }
);

router.post('/build', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const build = await startMobileApkBuild(req.user!.id);

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.CREATE,
      resource: 'mobile_release',
      resourceId: 'build',
      notes: 'APK build started from platform admin',
      ...req.auditMeta,
    });

    res.status(202).json(await getMobileReleaseAdminView());
  } catch (e) {
    next(e);
  }
});

export default router;
