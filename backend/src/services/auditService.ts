import { AuditAction } from '@prisma/client';
import prisma from '../config/database';
import { auditLogger } from '../config/logger';

interface AuditEntry {
  userId?: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  notes?: string;
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({ data: entry });
    auditLogger.info('AUDIT', entry);
  } catch (e) {
    auditLogger.error('Failed to write audit entry', { error: e, entry });
  }
}
