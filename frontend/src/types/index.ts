export type Permission =
  | 'TICKET_CREATE' | 'TICKET_READ' | 'TICKET_UPDATE' | 'TICKET_DELETE'
  | 'TICKET_ASSIGN' | 'TICKET_CLOSE' | 'TICKET_EXPORT'
  | 'USER_CREATE' | 'USER_READ' | 'USER_UPDATE' | 'USER_DELETE' | 'USER_ASSIGN_ROLE'
  | 'LOCATION_CREATE' | 'LOCATION_READ' | 'LOCATION_UPDATE' | 'LOCATION_DELETE'
  | 'ASSET_CREATE' | 'ASSET_READ' | 'ASSET_UPDATE' | 'ASSET_DELETE'
  | 'REPORT_VIEW' | 'REPORT_EXPORT' | 'ADMIN_PANEL' | 'AUDIT_LOG_VIEW' | 'EMAIL_SETTINGS';

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'ON_HOLD' | 'PENDING_PARTS' | 'PENDING_REVIEW' | 'COMPLETED' | 'CLOSED' | 'CANCELLED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TicketType = 'CORRECTIVE' | 'PREVENTIVE' | 'INSPECTION' | 'SAFETY' | 'PROJECT';

export interface User {
  id: string;
  email: string;
  name: string;
  role: { id: string; name: string; permissions: Permission[] };
  department?: string;
  phone?: string;
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
