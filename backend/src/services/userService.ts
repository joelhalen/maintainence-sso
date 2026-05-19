import bcrypt from 'bcryptjs';
import { AuditAction } from '@prisma/client';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { writeAudit } from './auditService';
import { assertWithinLimit, toOrganizationContext } from './entitlementService';

const PRIVILEGED_ROLE_NAMES = ['Super Admin', 'Admin'];

export interface CreateOrganizationUserInput {
  organizationId: string;
  email: string;
  name: string;
  roleId: string;
  password: string;
  department?: string | null;
  active?: boolean;
  isPlatformAdmin?: boolean;
  forbidPrivilegedRoles?: boolean;
  auditUserId?: string;
  auditMeta?: Record<string, unknown>;
}

export interface UpdateOrganizationUserInput {
  organizationId: string;
  userId: string;
  name?: string;
  email?: string;
  roleId?: string;
  department?: string | null;
  active?: boolean;
  password?: string;
  isPlatformAdmin?: boolean;
  auditUserId?: string;
  auditMeta?: Record<string, unknown>;
}

export async function createOrganizationUser(input: CreateOrganizationUserInput) {
  const org = await prisma.organization.findUnique({
    where: { id: input.organizationId },
    include: { subscription: { include: { plan: true } } },
  });
  if (!org || !org.active) {
    throw new AppError(404, 'Organization not found or inactive');
  }

  const existingEmail = await prisma.user.findUnique({ where: { email: input.email } });
  if (existingEmail) {
    throw new AppError(409, 'An account with this email already exists');
  }

  const role = await prisma.role.findFirst({
    where: { id: input.roleId, organizationId: input.organizationId },
  });
  if (!role) {
    throw new AppError(400, 'Role is not available for this organization');
  }
  if (input.forbidPrivilegedRoles && PRIVILEGED_ROLE_NAMES.includes(role.name)) {
    throw new AppError(403, 'This role cannot be assigned through registration');
  }

  await assertWithinLimit(toOrganizationContext(org), 'users');

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      roleId: input.roleId,
      organizationId: input.organizationId,
      department: input.department ?? undefined,
      passwordHash,
      active: input.active ?? true,
      isPlatformAdmin: input.isPlatformAdmin ?? false,
      notificationPref: { create: {} },
    },
    include: { role: { select: { id: true, name: true } } },
  });

  if (input.auditUserId) {
    await writeAudit({
      organizationId: input.organizationId,
      userId: input.auditUserId,
      action: AuditAction.CREATE,
      resource: 'users',
      resourceId: user.id,
      ...input.auditMeta,
    });
  }

  const { passwordHash: _, ...safeUser } = user;
  return safeUser;
}

export async function updateOrganizationUser(input: UpdateOrganizationUserInput) {
  const old = await prisma.user.findFirst({
    where: { id: input.userId, organizationId: input.organizationId },
  });
  if (!old) {
    throw new AppError(404, 'User not found');
  }

  const data: Record<string, unknown> = {};
  const allowed = ['name', 'department', 'active', 'roleId', 'isPlatformAdmin'] as const;
  for (const k of allowed) {
    if (input[k] !== undefined) data[k] = input[k];
  }

  if (input.email !== undefined && input.email !== old.email) {
    const taken = await prisma.user.findUnique({ where: { email: input.email } });
    if (taken && taken.id !== old.id) {
      throw new AppError(409, 'An account with this email already exists');
    }
    data.email = input.email;
  }

  if (input.roleId) {
    const role = await prisma.role.findFirst({
      where: { id: input.roleId, organizationId: input.organizationId },
    });
    if (!role) {
      throw new AppError(400, 'Role is not available for this organization');
    }
    if (input.auditUserId) {
      await writeAudit({
        organizationId: input.organizationId,
        userId: input.auditUserId,
        action: AuditAction.ROLE_CHANGE,
        resource: 'users',
        resourceId: input.userId,
        newValues: { roleId: input.roleId },
        ...input.auditMeta,
      });
    }
  }

  if (input.password) {
    data.passwordHash = await bcrypt.hash(input.password, 12);
  }

  const user = await prisma.user.update({
    where: { id: old.id },
    data,
    include: { role: { select: { id: true, name: true } } },
  });

  if (input.auditUserId) {
    await writeAudit({
      organizationId: input.organizationId,
      userId: input.auditUserId,
      action: AuditAction.UPDATE,
      resource: 'users',
      resourceId: user.id,
      oldValues: { name: old.name, department: old.department, active: old.active, roleId: old.roleId },
      newValues: data,
      ...input.auditMeta,
    });
  }

  const { passwordHash: _, ...safeUser } = user;
  return safeUser;
}

export async function resolveRegistrationRoleId(organizationId: string): Promise<string> {
  const roleName = process.env.REGISTRATION_DEFAULT_ROLE || 'Viewer';
  const role = await prisma.role.findFirst({
    where: { organizationId, name: roleName },
  });
  if (!role) {
    throw new AppError(500, `Default registration role "${roleName}" is not configured for this organization`);
  }
  return role.id;
}

export function isPublicRegistrationEnabled(): boolean {
  return process.env.PUBLIC_REGISTRATION_ENABLED !== 'false';
}
