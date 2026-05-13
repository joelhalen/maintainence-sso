import { Response, NextFunction } from 'express';
import { AuditAction } from '@prisma/client';
import { AuthRequest } from '../types';
import prisma from '../config/database';
import { auditLogger } from '../config/logger';

export const auditMiddleware = (resource: string, action: AuditAction) =>
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      if (res.statusCode < 400 && req.user) {
        const resourceId = (req.params.id as string) || (body as Record<string, string>)?.id;
        prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action,
            resource,
            resourceId,
            newValues: action !== AuditAction.DELETE ? (body as Record<string, unknown>) : undefined,
            ipAddress: req.auditMeta?.ipAddress,
            userAgent: req.auditMeta?.userAgent,
          },
        }).catch((e) => auditLogger.error('Failed to write audit log', e));
      }
      return originalJson(body);
    };
    next();
  };
