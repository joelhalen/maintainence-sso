export type Permission =
  | 'TICKET_CREATE' | 'TICKET_READ' | 'TICKET_UPDATE' | 'TICKET_DELETE'
  | 'TICKET_ASSIGN' | 'TICKET_CLOSE' | 'TICKET_EXPORT'
  | 'USER_CREATE' | 'USER_READ' | 'USER_UPDATE' | 'USER_DELETE' | 'USER_ASSIGN_ROLE'
  | 'LOCATION_CREATE' | 'LOCATION_READ' | 'LOCATION_UPDATE' | 'LOCATION_DELETE'
  | 'ASSET_CREATE' | 'ASSET_READ' | 'ASSET_UPDATE' | 'ASSET_DELETE'
  | 'REPORT_VIEW' | 'REPORT_EXPORT' | 'ADMIN_PANEL' | 'AUDIT_LOG_VIEW' | 'EMAIL_SETTINGS'
  | 'GROUP_MANAGE';

export type RuleAction = 'VIEW' | 'COMMENT' | 'UPDATE_STATUS' | 'CLOSE' | 'ASSIGN' | 'CREATE' | 'EXPORT';
export type RuleEffect = 'ALLOW' | 'DENY';
export type TicketTypeValue = 'CORRECTIVE' | 'PREVENTIVE' | 'INSPECTION' | 'SAFETY' | 'PROJECT';

export interface PermissionRule {
  id: string;
  userId?: string;
  groupId?: string;
  locationId?: string;
  ticketType?: TicketTypeValue;
  action: RuleAction;
  effect: RuleEffect;
  location?: { id: string; name: string };
  user?: { id: string; name: string; email: string };
  group?: { id: string; name: string };
  createdAt: string;
}

export interface GroupMember {
  id: string;
  addedAt: string;
  user: { id: string; name: string; email: string; role: { name: string }; department?: string; active: boolean };
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
  _count?: { members: number; rules: number };
  members?: GroupMember[];
  rules?: PermissionRule[];
}

export type SubscriptionTier = 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
export type SubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED';

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

export interface UsageSummary {
  activeUsers: number;
  locations: number;
  assets: number;
  activeTickets: number;
}

export interface OrganizationSubscriptionResponse {
  organization: OrganizationContext;
  usage: UsageSummary;
  billing?: {
    provider: string;
    providerCustomerId?: string | null;
    paypalSubscriptionId?: string | null;
    checkoutEnabled: boolean;
  };
}

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'ON_HOLD' | 'PENDING_PARTS' | 'PENDING_REVIEW' | 'COMPLETED' | 'CLOSED' | 'CANCELLED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TicketType = 'CORRECTIVE' | 'PREVENTIVE' | 'INSPECTION' | 'SAFETY' | 'PROJECT';

export interface User {
  id: string;
  email: string;
  name: string;
  isPlatformAdmin: boolean;
  organizationId: string;
  organization?: OrganizationContext;
  role: { id: string; name: string; permissions: Permission[] };
  department?: string;
  phone?: string;
  phoneVerifiedAt?: string;
  active: boolean;
  lastLoginAt?: string;
}

export interface Location {
  id: string;
  name: string;
  code?: string;
  description?: string;
  address?: string;
  parentId?: string;
  parent?: Pick<Location, 'id' | 'name'>;
  children?: Location[];
  active: boolean;
  _count?: { children: number; assets: number; tickets: number };
}

export interface AssetCategory {
  id: string;
  name: string;
}

export interface Asset {
  id: string;
  name: string;
  assetTag?: string;
  serialNumber?: string;
  model?: string;
  manufacturer?: string;
  category: AssetCategory;
  location: Pick<Location, 'id' | 'name'>;
  description?: string;
  installDate?: string;
  warrantyExp?: string;
  active: boolean;
  _count?: { tickets: number };
}

export interface TicketComment {
  id: string;
  content: string;
  isInternal: boolean;
  author: { id: string; name: string };
  createdAt: string;
  editedAt?: string;
}

export interface TicketStatusHistory {
  id: string;
  fromStatus?: TicketStatus;
  toStatus: TicketStatus;
  changedBy: { id: string; name: string };
  reason?: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  type: TicketType;
  status: TicketStatus;
  priority: TicketPriority;
  location: Pick<Location, 'id' | 'name'>;
  asset?: Pick<Asset, 'id' | 'name' | 'assetTag'>;
  createdBy: { id: string; name: string; email: string };
  assignedTo?: { id: string; name: string; email: string };
  completedBy?: { id: string; name: string; email: string };
  dueDate?: string;
  startedAt?: string;
  completedAt?: string;
  closedAt?: string;
  estimatedHours?: number;
  actualHours?: number;
  resolutionNotes?: string;
  tags: string[];
  comments?: TicketComment[];
  statusHistory?: TicketStatusHistory[];
  _count?: { comments: number; attachments: number };
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
