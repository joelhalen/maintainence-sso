import { AuditAction, Prisma } from '@prisma/client';
import prisma from '../config/database';
import { auditLogger } from '../config/logger';

interface AuditEntry {
  organizationId?: string;
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
    let organizationId = entry.organizationId;
    if (!organizationId && entry.userId) {
      const user = await prisma.user.findUnique({ where: { id: entry.userId }, select: { organizationId: true } });
      organizationId = user?.organizationId;
    }

    const auditEntry = { ...entry, organizationId };
    await prisma.auditLog.create({ data: auditEntry as Prisma.AuditLogUncheckedCreateInput });
    auditLogger.info('AUDIT', auditEntry);
  } catch (e) {
    auditLogger.error('Failed to write audit entry', { error: e, entry });
  }
}
