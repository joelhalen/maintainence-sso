import { Request } from 'express';
import { Permission, TicketStatus, TicketPriority, TicketType } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  roleId: string;
  roleName: string;
  permissions: Permission[];
}

export interface AuthRequest extends Request {
  user?: AuthUser;
  auditMeta?: {
    ipAddress: string;
    userAgent: string;
  };
}

export interface JwtPayload {
  sub: string;
  email: string;
  roleId: string;
  iat?: number;
  exp?: number;
}

export interface PaginationQuery {
  page?: string;
  limit?: string;
}

export interface TicketFilterQuery extends PaginationQuery {
  status?: TicketStatus;
  priority?: TicketPriority;
  type?: TicketType;
  assignedToId?: string;
  locationId?: string;
  assetId?: string;
  search?: string;
  from?: string;
  to?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface EmailOptions {
  to: string | string[];
  cc?: string | string[];
  subject: string;
  html: string;
  text?: string;
  ticketId?: string;
  templateName?: string;
}
