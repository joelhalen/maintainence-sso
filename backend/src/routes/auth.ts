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
import { toOrganizationContext } from '../services/entitlementService';

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
      include: {
        role: true,
        organization: { include: { subscription: { include: { plan: true } } } },
      },
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

    if (!user.active || !user.organization.active) {
      next(new AppError(403, 'Account disabled'));
      return;
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await writeAudit({ userId: user.id, action: AuditAction.LOGIN, resource: 'auth', ...meta });

    const expiresIn = (process.env.JWT_EXPIRES_IN || '8h') as jwt.SignOptions['expiresIn'];
    const token = jwt.sign(
      { sub: user.id, email: user.email, roleId: user.roleId, organizationId: user.organizationId },
      process.env.JWT_SECRET!,
      { expiresIn }
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
        organizationId: user.organizationId,
        organization: toOrganizationContext(user.organization),
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
    include: {
      role: true,
      organization: { include: { subscription: { include: { plan: true } } } },
    },
  });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const notificationPref = await prisma.notificationPreference.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });

  const { passwordHash: _, ...safeUser } = user;
  res.json({ ...safeUser, organization: toOrganizationContext(user.organization), notificationPref });
});

export default router;
