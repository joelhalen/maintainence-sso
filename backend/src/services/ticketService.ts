import { TicketStatus, TicketPriority, TicketType, AuditAction } from '@prisma/client';
import prisma from '../config/database';
import { getTicketReplyTo } from '../config/email';
import { sendEmail, ticketCreatedTemplate, ticketAssignedTemplate, ticketStatusChangedTemplate } from './emailService';
import { sendTicketSmsNotification } from './smsService';
import { getTicketVisibilityFilter } from './permissionService';
import { writeAudit } from './auditService';
import { AppError } from '../middleware/errorHandler';
import { AuthUser, TicketFilterQuery, PaginatedResult } from '../types';
import { assertWithinLimit } from './entitlementService';

const TICKET_PREFIX = process.env.TICKET_NUMBER_PREFIX || 'MNT';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

type NotificationEvent = 'onAssign' | 'onStatusChange';

interface NotifiableUser {
  id: string;
  email: string;
  phone?: string | null;
}

async function generateTicketNumber(organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.ticket.count({
    where: { organizationId, ticketNumber: { startsWith: `${TICKET_PREFIX}-${year}-` } },
  });
  return `${TICKET_PREFIX}-${year}-${String(count + 1).padStart(5, '0')}`;
}

async function getNotificationPreference(userId: string) {
  return prisma.notificationPreference.findUnique({ where: { userId } });
}

async function sendTicketEmailIfEnabled(
  user: NotifiableUser,
  organizationId: string,
  event: NotificationEvent,
  email: {
    subject: string;
    html: string;
    replyTo?: string;
    headers?: Record<string, string>;
    ticketId: string;
    templateName: string;
  }
): Promise<void> {
  const pref = await getNotificationPreference(user.id);
  if (pref && (!pref.emailEnabled || !pref[event])) return;

  sendEmail({
    organizationId,
    to: user.email,
    subject: email.subject,
    html: email.html,
    replyTo: email.replyTo,
    headers: email.headers,
    ticketId: email.ticketId,
    templateName: email.templateName,
  }).catch(() => {});
}


export async function listTickets(
  filters: TicketFilterQuery,
  user: AuthUser
): Promise<PaginatedResult<unknown>> {
  const page = Math.max(1, parseInt(filters.page || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(filters.limit || '25')));
  const skip = (page - 1) * limit;

  // Apply location-scoped visibility rules for non-admin users
  const visibilityFilter = await getTicketVisibilityFilter(user.id, user.permissions);
  const where: Record<string, unknown> = { organizationId: user.organizationId, ...visibilityFilter };


  if (filters.status) where.status = filters.status;
  if (filters.priority) where.priority = filters.priority;
  if (filters.type) where.type = filters.type;
  if (filters.locationId) where.locationId = filters.locationId;
  if (filters.assetId) where.assetId = filters.assetId;
  // Support the literal value "me" to mean "the current user"
  if (filters.assignedToId) {
    where.assignedToId = filters.assignedToId === 'me' ? user.id : filters.assignedToId;
  }
  if (filters.from || filters.to) {
    where.createdAt = {};
    if (filters.from) (where.createdAt as Record<string, unknown>).gte = new Date(filters.from);
    if (filters.to) (where.createdAt as Record<string, unknown>).lte = new Date(filters.to);
  }
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { ticketNumber: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      include: {
        location: { select: { id: true, name: true } },
        asset: { select: { id: true, name: true, assetTag: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        _count: { select: { comments: true, attachments: true } },
      },
    }),
    prisma.ticket.count({ where }),
  ]);

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function createTicket(
  input: {
    title: string;
    description: string;
    type: TicketType;
    priority: TicketPriority;
    locationId: string;
    assetId?: string;
    assignedToId?: string;
    dueDate?: Date;
    estimatedHours?: number;
    tags?: string[];
  },
  user: AuthUser,
  meta: { ipAddress: string; userAgent: string }
) {
  await assertWithinLimit(user.organization, 'activeTickets');

  const [location, asset, assignedTo] = await Promise.all([
    prisma.location.findFirst({ where: { id: input.locationId, organizationId: user.organizationId } }),
    input.assetId ? prisma.asset.findFirst({ where: { id: input.assetId, organizationId: user.organizationId } }) : Promise.resolve(null),
    input.assignedToId ? prisma.user.findFirst({ where: { id: input.assignedToId, organizationId: user.organizationId } }) : Promise.resolve(null),
  ]);
  if (!location) throw new AppError(400, 'Location is not available for this organization');
  if (input.assetId && !asset) throw new AppError(400, 'Asset is not available for this organization');
  if (input.assignedToId && !assignedTo) throw new AppError(400, 'Assignee is not available for this organization');

  const ticketNumber = await generateTicketNumber(user.organizationId);

  const ticket = await prisma.ticket.create({
    data: {
      ...input,
      organizationId: user.organizationId,
      ticketNumber,
      status: TicketStatus.OPEN,
      createdById: user.id,
    },
    include: {
      location: true,
      asset: true,
      createdBy: true,
      assignedTo: true,
    },
  });

  await prisma.ticketStatusHistory.create({
    data: {
      organizationId: user.organizationId,
      ticketId: ticket.id,
      toStatus: TicketStatus.OPEN,
      changedById: user.id,
    },
  });

  await writeAudit({
    organizationId: user.organizationId,
    userId: user.id,
    action: AuditAction.CREATE,
    resource: 'tickets',
    resourceId: ticket.id,
    newValues: { ticketNumber, title: input.title, status: TicketStatus.OPEN },
    ...meta,
  });

  const ticketUrl = `${FRONTEND_URL}/tickets/${ticket.id}`;
  const replyTo = getTicketReplyTo(ticket.ticketNumber);

  if (ticket.assignedTo) {
    const assignedTemplateData = {
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        priority: ticket.priority,
        status: ticket.status,
        location: ticket.location.name,
        asset: ticket.asset?.name,
        createdBy: ticket.createdBy.name,
        dueDate: ticket.dueDate?.toLocaleDateString(),
        description: ticket.description,
        ticketUrl,
      };

    sendTicketEmailIfEnabled(ticket.assignedTo, user.organizationId, 'onAssign', {
      subject: `[${ticket.ticketNumber}] Ticket Assigned: ${ticket.title}`,
      html: ticketAssignedTemplate(assignedTemplateData),
      replyTo,
      ticketId: ticket.id,
      templateName: 'ticket_assigned',
    }).catch(() => {});

    sendTicketSmsNotification(ticket.assignedTo.id, 'assign', {
      ticketNumber: ticket.ticketNumber,
      title: ticket.title,
      url: ticketUrl,
    }).catch(() => {});
  }

  return ticket;
}

export async function updateTicketStatus(
  ticketId: string,
  newStatus: TicketStatus,
  user: AuthUser,
  meta: { ipAddress: string; userAgent: string },
  reason?: string,
  resolutionNotes?: string
) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { createdBy: true, assignedTo: true, location: true },
  });
  if (!ticket || ticket.organizationId !== user.organizationId) throw new AppError(404, 'Ticket not found');

  const updateData: Record<string, unknown> = { status: newStatus };
  if (newStatus === TicketStatus.IN_PROGRESS && !ticket.startedAt) updateData.startedAt = new Date();
  if (newStatus === TicketStatus.COMPLETED) {
    updateData.completedAt = new Date();
    updateData.completedById = user.id;
    if (resolutionNotes) updateData.resolutionNotes = resolutionNotes;
  }
  if (newStatus === TicketStatus.CLOSED) {
    updateData.closedAt = new Date();
    updateData.closedById = user.id;
  }

  const updated = await prisma.ticket.update({
    where: { id: ticketId },
    data: updateData,
  });

  await prisma.ticketStatusHistory.create({
    data: {
      organizationId: user.organizationId,
      ticketId,
      fromStatus: ticket.status,
      toStatus: newStatus,
      changedById: user.id,
      reason,
    },
  });

  await writeAudit({
    organizationId: user.organizationId,
    userId: user.id,
    action: AuditAction.STATUS_CHANGE,
    resource: 'tickets',
    resourceId: ticketId,
    oldValues: { status: ticket.status },
    newValues: { status: newStatus, reason },
    ...meta,
  });

  const ticketUrl = `${FRONTEND_URL}/tickets/${ticket.id}`;
  const replyTo = getTicketReplyTo(ticket.ticketNumber);
  const notifyUsers = [ticket.createdBy];
  if (ticket.assignedTo && ticket.assignedTo.id !== ticket.createdBy.id) {
    notifyUsers.push(ticket.assignedTo);
  }

  for (const u of notifyUsers) {
    const statusTemplateData = {
      ticketNumber: ticket.ticketNumber,
      title: ticket.title,
      priority: ticket.priority,
      status: newStatus,
      location: ticket.location.name,
      createdBy: ticket.createdBy.name,
      description: ticket.description,
      ticketUrl,
      changedBy: user.name,
    };

    sendTicketEmailIfEnabled(u, user.organizationId, 'onStatusChange', {
      subject: `[${ticket.ticketNumber}] Status Updated: ${newStatus}`,
      html: ticketStatusChangedTemplate(statusTemplateData),
      replyTo,
      ticketId: ticket.id,
      templateName: 'ticket_status_changed',
    }).catch(() => {});

    sendTicketSmsNotification(u.id, 'status', {
      ticketNumber: ticket.ticketNumber,
      title: ticket.title,
      url: ticketUrl,
      detail: newStatus.replace(/_/g, ' '),
    }).catch(() => {});
  }

  return updated;
}
