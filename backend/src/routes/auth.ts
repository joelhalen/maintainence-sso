import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { writeAudit } from '../services/auditService';
import { AuditAction } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

const getClientMeta = (req: Request) => ({
  ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown',
  userAgent: req.headers['user-agent'] || 'unknown',
});

router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      next(new AppError(400, 'Invalid request body'));
      return;
    }

    const { email, password } = req.body;
    const meta = getClientMeta(req);

    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });

    if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      await writeAudit({
        action: AuditAction.LOGIN_FAILED,
        resource: 'auth',
        notes: email,
        ...meta,
      });
      next(new AppError(401, 'Invalid credentials'));
      return;
    }

    if (!user.active) {
      next(new AppError(403, 'Account disabled'));
      return;
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await writeAudit({ userId: user.id, action: AuditAction.LOGIN, resource: 'auth', ...meta });

    const token = jwt.sign(
      { sub: user.id, email: user.email, roleId: user.roleId },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        department: user.department,
        phone: user.phone,
        active: user.active,
        role: {
          id: user.role.id,
          name: user.role.name,
          permissions: user.role.permissions,
        },
      },
    });
  }
);

router.post('/logout', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  await writeAudit({
    userId: req.user!.id,
    action: AuditAction.LOGOUT,
    resource: 'auth',
    ...req.auditMeta,
  });
  res.json({ message: 'Logged out successfully' });
});

router.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: { role: true, notificationPref: true },
  });
  res.json(user);
});

export default router;
