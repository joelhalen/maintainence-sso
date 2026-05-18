import { Router, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { AuthRequest } from '../types';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import prisma from '../config/database';

const router = Router();
router.use(authenticate);

// List active device tokens for the current user
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const devices = await prisma.deviceToken.findMany({
      where: { userId: req.user!.id, organizationId: req.user!.organizationId },
      orderBy: { lastSeen: 'desc' },
    });
    res.json(devices);
  } catch (e) {
    next(e);
  }
});

// Register or refresh a device push token
router.post(
  '/',
  [
    body('token').trim().notEmpty(),
    body('platform').isIn(['IOS', 'ANDROID', 'WEB']),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      next(new AppError(400, errors.array()[0].msg as string));
      return;
    }
    try {
      const { token, platform } = req.body;
      const device = await prisma.deviceToken.upsert({
        where: { token },
        update: {
          userId: req.user!.id,
          organizationId: req.user!.organizationId,
          platform,
          active: true,
          lastSeen: new Date(),
        },
        create: {
          organizationId: req.user!.organizationId,
          userId: req.user!.id,
          token,
          platform,
        },
      });
      res.status(201).json(device);
    } catch (e) {
      next(e);
    }
  }
);

// Deregister a device token (on logout from mobile)
router.delete(
  '/:token',
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await prisma.deviceToken.updateMany({
        where: { token: req.params.token, userId: req.user!.id, organizationId: req.user!.organizationId },
        data: { active: false },
      });
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  }
);

export default router;
