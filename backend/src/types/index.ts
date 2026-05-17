import { Request } from 'express';
import { Permission, SubscriptionStatus, SubscriptionTier, TicketStatus, TicketPriority, TicketType } from '@prisma/client';

export interface SubscriptionLimits {
  maxActiveUsers: number | null;
  maxLocations: number | null;
  maxAssets: number | null;
  maxActiveTickets: number | null;
  allowSms: boolean;
  allowSso: boolean;
  allowExports: boolean;
}

export interface OrganizationContext {
  id: string;
  name: string;
  slug: string;
  subscription: {
    status: SubscriptionStatus;
    provider: string;
    providerCustomerId?: string | null;
    paypalSubscriptionId?: string | null;
    plan: {
      id: string;
      tier: SubscriptionTier;
      name: string;
      limits: SubscriptionLimits;
    };
  };
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  roleId: string;
  roleName: string;
  permissions: Permission[];
  organizationId: string;
  organization: OrganizationContext;
}

declare global {
  namespace Express {
    interface User extends AuthUser {}
  }
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
  organizationId?: string;
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
  replyTo?: string;
  headers?: Record<string, string>;
  organizationId?: string;
  ticketId?: string;
  templateName?: string;
}

export interface SmsOptions {
  to: string;
  body: string;
  organizationId?: string;
  userId?: string;
  ticketId?: string;
}
