import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest, AuthUser, JwtPayload } from '../types';
import prisma from '../config/database';
import { AppError } from './errorHandler';

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(new AppError(401, 'Authentication required'));
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

    const user = await prisma.user.findUnique({
      where: { id: payload.sub, active: true },
      include: { role: true },
    });

    if (!user) {
      next(new AppError(401, 'User not found or inactive'));
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      roleId: user.roleId,
      roleName: user.role.name,
      permissions: user.role.permissions,
    } as AuthUser;

    req.auditMeta = {
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    };

    next();
  } catch {
    next(new AppError(401, 'Invalid or expired token'));
  }
};
