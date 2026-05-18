import { Response, NextFunction } from 'express';
import { Permission } from '@prisma/client';
import { AuthRequest } from '../types';
import { AppError } from './errorHandler';

export const requirePermission = (...permissions: Permission[]) =>
  (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError(401, 'Authentication required'));
      return;
    }
    const hasAll = permissions.every((p) => req.user!.permissions.includes(p));
    if (!hasAll) {
      next(new AppError(403, 'Insufficient permissions'));
      return;
    }
    next();
  };

export const requireAnyPermission = (...permissions: Permission[]) =>
  (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError(401, 'Authentication required'));
      return;
    }
    const hasAny = permissions.some((p) => req.user!.permissions.includes(p));
    if (!hasAny) {
      next(new AppError(403, 'Insufficient permissions'));
      return;
    }
    next();
  };

export const requirePlatformAdmin = (req: AuthRequest, _res: Response, next: NextFunction): void => {
  if (!req.user) {
    next(new AppError(401, 'Authentication required'));
    return;
  }
  if (!req.user.isPlatformAdmin) {
    next(new AppError(403, 'Platform administrator access required'));
    return;
  }
  next();
};
