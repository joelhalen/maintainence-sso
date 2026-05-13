# MegaMTX — Application Design Reference

**Version:** 1.0  
**Status:** Living Document  
**Last Updated:** 2026-05-13  
**Authors:** Engineering Team

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Vision & Goals](#2-vision--goals)
3. [Architecture Overview](#3-architecture-overview)
4. [Technology Stack & Rationale](#4-technology-stack--rationale)
5. [Data Architecture](#5-data-architecture)
6. [Role-Based Access Control (RBAC)](#6-role-based-access-control-rbac)
7. [Ticket Lifecycle](#7-ticket-lifecycle)
8. [Location & Asset Hierarchy](#8-location--asset-hierarchy)
9. [Communication System](#9-communication-system)
10. [FDA 21 CFR Part 11 Compliance](#10-fda-21-cfr-part-11-compliance)
11. [API Design](#11-api-design)
12. [Authentication & SSO](#12-authentication--sso)
13. [Mobile Application Strategy](#13-mobile-application-strategy)
14. [Security Architecture](#14-security-architecture)
15. [Deployment Architecture](#15-deployment-architecture)
16. [Development Conventions](#16-development-conventions)
17. [Future Roadmap](#17-future-roadmap)

---

## 1. Executive Summary

MegaMTX is a full-stack, in-house maintenance management system built to replace a costly third-party SaaS platform (MaintainX or equivalent). The system enables maintenance teams to create, track, assign, and close work orders (called **tickets**) across a structured hierarchy of physical locations and assets. It is designed from the ground up to meet FDA 21 CFR Part 11 requirements for electronic records and electronic signatures.

### Why MegaMTX Was Built

Organizations operating in regulated industries — particularly pharmaceutical and medical device manufacturing — pay substantial recurring fees for third-party CMMS/maintenance SaaS platforms. These platforms often offer more features than are used, charge per-seat, and make it difficult to export or own the underlying data. MegaMTX was built to:

- **Eliminate recurring SaaS spend** by running on owned infrastructure with no per-seat licensing.
- **Own the data completely** — all records, audit logs, and electronic signatures live in a company-controlled PostgreSQL database.
- **Gain full visibility and customizability** — every workflow, permission, and notification can be tuned to the organization's exact needs.
- **Satisfy compliance requirements without bolt-ons** — Part 11 compliance is built into the core data model, not retrofitted as an add-on module.

### Target Users

| Role | Description |
|---|---|
| **Maintenance Technician** | Executes work, updates ticket status, logs time, adds comments |
| **Supervisor** | Assigns tickets, reviews work, approves completions, exports reports |
| **Operator** | Floor-level staff who can report problems by opening corrective tickets |
| **Admin** | Manages users, roles, locations, assets, and system configuration |
| **Viewer** | Read-only access for stakeholders (QA, management) |
| **Super Admin** | Full system access including audit log access and email settings |

### Core Value Propositions

- **Cost savings**: Eliminate SaaS subscription fees. Hosting on existing infrastructure costs a fraction of per-seat pricing.
- **Operator visibility**: Floor operators can report issues and track status without needing a full technician license.
- **Regulatory compliance**: Electronic records and electronic signatures meet FDA 21 CFR Part 11 requirements out of the box.
- **Customizability**: Roles, permissions, ticket types, priorities, location hierarchies, and notification preferences are all configurable by in-house administrators.
- **Data ownership**: All data is stored in a company-managed PostgreSQL instance. There is no external dependency for record retrieval, export, or long-term retention.

---

## 2. Vision & Goals

### Primary Goal: Replace Third-Party CMMS SaaS

The primary driver is replacing an externally hosted MaintainX (or equivalent) subscription. The replacement must achieve functional parity for the workflows the organization actually uses: corrective maintenance tickets, preventive maintenance scheduling, assignment and tracking, comments and attachments, and status-based lifecycle management. Anything beyond that is a bonus.

### Secondary Goal: FDA 21 CFR Part 11 Compliance

Maintenance records in regulated manufacturing environments are part of the quality system and may be inspected by the FDA. MegaMTX is designed so that every record mutation is audited with a computer-generated, date-time-stamped, operator-attributed entry. Electronic signatures are cryptographically associated with specific records and carry explicit meaning statements. The audit log is append-only by policy and cannot be modified through the application layer.

### Tertiary Goal: Mobile-First Thinking

Native mobile apps (iOS and Android) are planned for Phase 3. However, the backend API is designed to serve mobile clients from day one. This means:
- All data is paginated and filterable, not returned in bulk.
- Token-based auth (JWT) rather than cookie-based sessions.
- Attachment upload via multipart form data (compatible with both web and native HTTP clients).
- A device token registration endpoint is reserved for future push notification integration.
- QR/barcode asset scanning is accommodated in the data model (`assetTag`, `qrCode` fields on `Asset`).

The web frontend is intentionally built with responsive layouts and mobile-friendly interaction patterns so that the transition to native apps involves extending, not rewriting, the backend.

### Non-Goals

MegaMTX is explicitly **not**:

- **A capital planning or CMMS replacement for full lifecycle asset management.** It does not track depreciation, replacement cost modeling, or capital budgets.
- **An inventory or purchasing system.** It does not manage spare parts stock, purchase orders, or vendor relationships (though future phases may link read-only to an external ERP for parts availability).
- **A general-purpose project management tool.** It is purpose-built for facility and equipment maintenance workflows.

---

## 3. Architecture Overview

### Monorepo Structure

```
maintainence-sso/            ← repository root
├── backend/                 ← Node.js + TypeScript + Express API
│   ├── src/
│   │   ├── app.ts           ← Express app factory
│   │   ├── server.ts        ← HTTP server entrypoint
│   │   ├── config/          ← DB, logger, email, Redis config
│   │   ├── middleware/       ← auth, RBAC, error handling, audit injection
│   │   ├── routes/          ← thin route controllers (tickets, auth, users, etc.)
│   │   ├── services/        ← business logic (ticketService, emailService, auditService)
│   │   └── types/           ← shared TypeScript type definitions
│   └── prisma/
│       └── schema.prisma    ← single source of truth for data model
├── frontend/                ← React + TypeScript + Vite + Tailwind web app
│   └── src/
│       ├── api/             ← API client functions (React Query hooks)
│       ├── components/      ← reusable UI components
│       ├── contexts/        ← AuthContext, etc.
│       ├── pages/           ← route-level page components
│       └── types/           ← TypeScript types (mirrored from backend)
├── docs/                    ← architecture documents (this file)
├── docker-compose.yml       ← Postgres 16 + Redis 7 for local dev
└── README.md
```

**Planned additions (Phase 3):**
```
├── mobile/
│   ├── ios/                 ← Swift + SwiftUI native iOS app
│   └── android/             ← Kotlin + Jetpack Compose native Android app
└── packages/
    └── shared-types/        ← extracted TypeScript types consumed by all clients
```

### Separation of Concerns

The backend follows a three-layer architecture:

1. **API Layer (routes/):** Express route handlers validate incoming requests using `express-validator`, enforce authentication and RBAC via middleware, then delegate all business logic to the service layer. Route handlers do not contain any business logic or direct database calls.

2. **Service Layer (services/):** Contains all business logic — ticket creation, status transitions, email notifications, audit writes. Services call Prisma directly and are fully unit-testable. The `writeAudit()` function in `auditService.ts` is called from every mutation in every service.

3. **Data Layer (Prisma + PostgreSQL):** All database access goes through the Prisma client using parameterized queries. No raw SQL is used anywhere. The schema is the single source of truth; migrations are generated by Prisma and tracked in version control.

### Why REST Over GraphQL

GraphQL was considered and rejected for the following reasons:
- **Mobile caching**: REST responses map cleanly to HTTP cache semantics. GraphQL's POST-based query model requires a dedicated client-side cache (Apollo, Relay), adding significant complexity for native mobile clients.
- **Simplicity**: The domain entities (tickets, users, locations, assets) are well-defined and do not require ad-hoc field selection. The verbosity of GraphQL schema maintenance is not justified.
- **Tooling maturity**: REST APIs are universally understood, easy to test with curl or Postman, and require no special client library. This reduces onboarding friction for future maintainers.
- **Part 11 compatibility**: REST's explicit endpoint-per-action model maps cleanly to audit log entries (action + resource + resourceId).

---

## 4. Technology Stack & Rationale

### Backend

| Technology | Version | Rationale |
|---|---|---|
| **Node.js** | 20 LTS | Async I/O is well-suited for a web API that does many database queries and sends emails. The TypeScript ecosystem is mature on Node. The team has existing Node.js expertise. |
| **TypeScript** | 5.x (strict) | Eliminates entire classes of runtime bugs. Strict mode (`noImplicitAny`, `strictNullChecks`) is enforced. Types are shared between backend and frontend to prevent API contract drift. |
| **Express** | 4.x | Chosen over Fastify for ecosystem familiarity, breadth of middleware (Helmet, cors, rate-limit, morgan, passport), and lower learning curve for new contributors. Fastify's marginal throughput gains are irrelevant at maintenance ticket volumes. |
| **Prisma ORM** | 5.x | Chosen over TypeORM (verbose, decorator-heavy, poor migration tooling) and Drizzle (excellent but newer, less documentation). Prisma's migration workflow (`prisma migrate dev`, `prisma migrate deploy`) is clean and deterministic. The generated client is fully typed. Schema is readable without ORM expertise. |
| **PostgreSQL** | 16 | Chosen over MySQL (less rich JSON support, weaker row-level locking) and MongoDB (ACID compliance required for audit log integrity; relational model is the right fit for tickets, roles, and hierarchies). Postgres's `JSONB` columns are used for `oldValues`/`newValues` in `AuditLog` and `specifications` in `Asset`. |
| **bcryptjs** | — | Password hashing at 12 rounds. Computationally expensive enough to resist offline dictionary attacks; 12 rounds is the current industry recommendation for bcrypt cost factors. |
| **jsonwebtoken** | — | JWT generation and verification. Currently HS256 (HMAC-SHA256) with a long random secret. RS256 (RSA asymmetric) is recommended for production to allow token verification without exposing the signing key. |
| **passport-saml** | — | SAML 2.0 SP-initiated and IdP-initiated SSO. Compatible with Azure AD and Okta out of the box via metadata XML. |
| **Nodemailer** | — | Transactional email via SMTP. No dependency on a SaaS email provider (SendGrid, Mailgun) in the default configuration — any SMTP relay (company mail server, or a self-hosted relay) works. |
| **Winston** | — | Structured JSON logging to rotating daily log files. Log rotation is configured for 30-day retention on application logs. Chosen over Pino for broader familiarity; both are appropriate. |
| **Helmet.js** | — | Sets secure HTTP headers: `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`, `X-DNS-Prefetch-Control`. |
| **express-rate-limit** | — | Per-IP rate limiting: 200 requests per 15 minutes globally, 20 per 15 minutes on authentication endpoints. |
| **Redis** | 7 | Used as a session store and general-purpose cache. Reserved for future job queues (recurring preventive maintenance schedules, SLA escalation jobs). |

### Frontend

| Technology | Version | Rationale |
|---|---|---|
| **React** | 18 | Industry standard for complex UI. Team expertise. Large ecosystem. |
| **TypeScript** | 5.x | Same rationale as backend. Shared type definitions prevent silent API contract mismatches. |
| **Vite** | 5.x | Fast dev server and optimized production builds. Replaces Create React App (deprecated). HMR is near-instant. |
| **Tailwind CSS** | 3.x | Chosen over component libraries (MUI, Chakra, Ant Design) because maintenance workflows require custom, context-specific UI that component library defaults fight against. Tailwind allows precise control over spacing, color, and layout without fighting component defaults. Utility-first CSS scales well with TypeScript-first development. |
| **React Query (TanStack Query)** | 5.x | Server state management: caching, background refetching, optimistic updates, pagination. Eliminates manual loading/error state management in components. Works well with REST APIs. |
| **React Router** | 6.x | Client-side routing with nested routes. |

---

## 5. Data Architecture

All models are defined in `backend/prisma/schema.prisma`. Prisma maps TypeScript camelCase field names to snake_case PostgreSQL columns automatically via `@map` or by convention, depending on configuration.

### User

**Purpose:** Represents an authenticated human user of the system, whether a maintenance technician, supervisor, operator, or administrator. Supports both local password authentication and SSO-based authentication.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | String (cuid) | PK | Auto-generated CUID |
| `email` | String | Unique, not null | Normalized to lowercase |
| `name` | String | Not null | Display name |
| `passwordHash` | String? | Nullable | Null for SSO-only users |
| `ssoId` | String? | Unique, nullable | IdP subject identifier |
| `ssoProvider` | String? | Nullable | e.g., `azure`, `okta` |
| `roleId` | String | FK → Role, not null | Every user has exactly one role |
| `department` | String? | Nullable | Organizational department |
| `phone` | String? | Nullable | For future SMS notifications |
| `active` | Boolean | Default true | Soft-disable without deleting |
| `lastLoginAt` | DateTime? | Nullable | Updated on every successful login |
| `createdAt` | DateTime | Auto | Record creation timestamp |
| `updatedAt` | DateTime | Auto-update | Last modification timestamp |

**Relationships:** Has many `createdTickets`, `assignedTickets`, `completedTickets`, `closedTickets`, `comments`, `statusHistory`, `auditLogs`, `signatures`. Has one `notificationPref`.

**Indexes:** `email` (for login lookups), `roleId` (for permission queries).

### Role

**Purpose:** Defines a named set of permissions. Users are assigned exactly one role. Both system-defined roles and custom admin-created roles are stored here.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | String (cuid) | PK | |
| `name` | String | Unique, not null | e.g., `Super Admin`, `Technician` |
| `description` | String? | Nullable | Human-readable description |
| `permissions` | Permission[] | Array enum | Postgres native array of enum values |
| `isSystem` | Boolean | Default false | System roles cannot be deleted |
| `createdAt` | DateTime | Auto | |
| `updatedAt` | DateTime | Auto-update | |

**Relationships:** Has many `users`.

**Design note:** Storing permissions as a Postgres enum array on the Role record means permission checks are O(n) on the permissions array, which is fine given the maximum of 25 permissions. No junction table is needed, and the RBAC middleware can check permissions from the JWT-hydrated user object without an additional DB query.

### Location

**Purpose:** Represents a physical place within the organization. Supports unlimited nesting depth through a self-referential parent/child relationship.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | String (cuid) | PK | |
| `name` | String | Not null | Human-readable name |
| `code` | String? | Unique, nullable | Short reference code, e.g., `MAIN-B1-F2` |
| `description` | String? | Nullable | |
| `address` | String? | Nullable | For top-level site locations |
| `parentId` | String? | FK → Location (self), nullable | Null = root location |
| `active` | Boolean | Default true | |
| `createdAt` | DateTime | Auto | |
| `updatedAt` | DateTime | Auto-update | |

**Relationships:** `parent` (self → Location?), `children` (self → Location[]), `assets` (Asset[]), `tickets` (Ticket[]).

**Indexes:** `parentId` for efficient subtree queries.

### AssetCategory

**Purpose:** Classifies assets into logical groups (e.g., HVAC, Electrical, Plumbing, Production Equipment) for filtering and reporting.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | String (cuid) | PK | |
| `name` | String | Unique, not null | Category label |

**Relationships:** Has many `assets`.

### Asset

**Purpose:** Represents a physical piece of equipment or infrastructure. Assets are tied to a specific location and category. Each asset can have a scannable barcode or QR code for mobile identification.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | String (cuid) | PK | |
| `name` | String | Not null | Common name of the equipment |
| `assetTag` | String? | Unique, nullable | Physical asset tag / barcode value |
| `serialNumber` | String? | Nullable | Manufacturer serial number |
| `model` | String? | Nullable | Equipment model name |
| `manufacturer` | String? | Nullable | OEM manufacturer name |
| `categoryId` | String | FK → AssetCategory | |
| `locationId` | String | FK → Location | Asset's primary location |
| `description` | String? | Nullable | |
| `installDate` | DateTime? | Nullable | Date equipment was placed in service |
| `warrantyExp` | DateTime? | Nullable | Warranty expiration date |
| `qrCode` | String? | Unique, nullable | QR code payload (often same as assetTag) |
| `specifications` | Json? | Nullable | Flexible key-value equipment specs |
| `active` | Boolean | Default true | |
| `createdAt` | DateTime | Auto | |
| `updatedAt` | DateTime | Auto-update | |

**Relationships:** Belongs to `category`, `location`. Has many `tickets`.

**Indexes:** `locationId` (assets by location), `categoryId` (assets by category).

### Ticket

**Purpose:** The central work order record. Represents a single unit of maintenance work with a defined lifecycle, priority, type, and assignment. Every ticket is linked to a location and optionally to a specific asset.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | String (cuid) | PK | |
| `ticketNumber` | String | Unique, not null | Format: `MNT-YYYY-NNNNN` |
| `title` | String | Not null, max 200 chars | Brief summary |
| `description` | String | Not null | Full problem description |
| `type` | TicketType enum | Not null | CORRECTIVE, PREVENTIVE, INSPECTION, SAFETY, PROJECT |
| `status` | TicketStatus enum | Default OPEN | State machine value |
| `priority` | TicketPriority enum | Default MEDIUM | LOW, MEDIUM, HIGH, CRITICAL |
| `locationId` | String | FK → Location | Where the work takes place |
| `assetId` | String? | FK → Asset, nullable | Specific asset affected |
| `createdById` | String | FK → User | Who opened the ticket |
| `assignedToId` | String? | FK → User, nullable | Assigned technician |
| `completedById` | String? | FK → User, nullable | Who marked it COMPLETED |
| `closedById` | String? | FK → User, nullable | Who marked it CLOSED |
| `dueDate` | DateTime? | Nullable | Target completion date |
| `startedAt` | DateTime? | Nullable | Set when first moved to IN_PROGRESS |
| `completedAt` | DateTime? | Nullable | Set when moved to COMPLETED |
| `closedAt` | DateTime? | Nullable | Set when moved to CLOSED |
| `estimatedHours` | Decimal(8,2)? | Nullable | Pre-work time estimate |
| `actualHours` | Decimal(8,2)? | Nullable | Logged on completion |
| `resolutionNotes` | String? | Nullable | Summary of work performed |
| `tags` | String[] | Array | Free-form labels for search/filter |
| `createdAt` | DateTime | Auto | |
| `updatedAt` | DateTime | Auto-update | |

**Relationships:** `location`, `asset`, `createdBy`, `assignedTo`, `completedBy`, `closedBy`, `comments` (TicketComment[]), `attachments` (Attachment[]), `statusHistory` (TicketStatusHistory[]), `emailLogs` (EmailLog[]), `signatures` (ElectronicSignature[]).

**Indexes:** `status`, `priority`, `locationId`, `assignedToId`, `createdById`, `createdAt`. These support the most common query patterns: open tickets by location, tickets by assignee, overdue tickets by createdAt.

### TicketComment

**Purpose:** Threaded comments on a ticket. Supports both public comments (visible to all with ticket access) and internal comments (visible only to technicians and supervisors, hidden from operators and viewers).

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | String (cuid) | PK | |
| `ticketId` | String | FK → Ticket (cascade delete) | |
| `authorId` | String | FK → User | |
| `content` | String | Not null | |
| `isInternal` | Boolean | Default false | If true, hidden from Operator/Viewer |
| `editedAt` | DateTime? | Nullable | Set if comment was edited |
| `createdAt` | DateTime | Auto | |
| `updatedAt` | DateTime | Auto-update | |

**Indexes:** `ticketId` for efficient comment list retrieval.

### TicketStatusHistory

**Purpose:** Immutable append-only record of every status transition a ticket undergoes. Required for Part 11 audit trail and for rendering a timeline view of ticket lifecycle events.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | String (cuid) | PK | |
| `ticketId` | String | FK → Ticket (cascade delete) | |
| `fromStatus` | TicketStatus? | Nullable | Null for initial OPEN creation |
| `toStatus` | TicketStatus | Not null | |
| `changedById` | String | FK → User | Who made the change |
| `reason` | String? | Nullable | Optional justification for the transition |
| `createdAt` | DateTime | Auto | Immutable timestamp |

**Indexes:** `ticketId`.

**Note:** This model has no `updatedAt` field intentionally. Records are never modified after creation.

### Attachment

**Purpose:** Files (photos, PDFs, documents) uploaded to a ticket as evidence of the problem or the repair.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | String (cuid) | PK | |
| `ticketId` | String | FK → Ticket (cascade delete) | |
| `filename` | String | Not null | Stored filename (UUID-based, not original) |
| `originalName` | String | Not null | Original upload filename |
| `url` | String | Not null | Relative path served by Express static |
| `mimeType` | String | Not null | Validated at upload time |
| `sizeBytes` | Int | Not null | |
| `uploadedById` | String | Not null | User who uploaded |
| `createdAt` | DateTime | Auto | |

**Indexes:** `ticketId`.

### ElectronicSignature

**Purpose:** FDA 21 CFR Part 11-compliant electronic signature bound to a ticket. Captures the signer's identity, the meaning of the signature, a cryptographic hash, client IP, and timestamp.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | String (cuid) | PK | |
| `ticketId` | String | FK → Ticket | |
| `userId` | String | FK → User | The signer |
| `meaning` | String | Not null | e.g., "I certify this work was completed per SOP-MNT-001" |
| `hash` | String | Not null | SHA-256 of (ticketId + userId + meaning + signedAt + secret) |
| `ipAddress` | String? | Nullable | Client IP at time of signing |
| `signedAt` | DateTime | Default now() | Immutable timestamp |

**Indexes:** `ticketId`.

**Design note:** The `meaning` field is mandatory and must be a non-trivial statement, not just a name. This satisfies 21 CFR Part 11 § 11.50 requirement that electronic signatures have a printed name, date, and meaning associated with the signature manifestation.

### AuditLog

**Purpose:** The central compliance audit trail. Every CREATE, UPDATE, DELETE, LOGIN, LOGOUT, STATUS_CHANGE, ASSIGN, EXPORT, and SIGN operation writes an immutable record here. This table is append-only at the application layer — no `UPDATE` or `DELETE` operations are ever issued against it.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | String (cuid) | PK | |
| `userId` | String? | FK → User, nullable | Null for anonymous/system actions |
| `action` | AuditAction enum | Not null | CREATE, UPDATE, DELETE, LOGIN, LOGOUT, LOGIN_FAILED, PASSWORD_CHANGE, ROLE_CHANGE, STATUS_CHANGE, ASSIGN, UNASSIGN, EXPORT, SIGN |
| `resource` | String | Not null | e.g., `tickets`, `users`, `auth` |
| `resourceId` | String? | Nullable | ID of the affected record |
| `oldValues` | Json? | Nullable | State before the change |
| `newValues` | Json? | Nullable | State after the change |
| `ipAddress` | String? | Nullable | Client IP address |
| `userAgent` | String? | Nullable | Client User-Agent header |
| `notes` | String? | Nullable | Additional context |
| `createdAt` | DateTime | Auto | Immutable, server-generated |

**Indexes:** `userId`, `(resource, resourceId)` compound, `createdAt`, `action`. These support audit log queries by user, by record, by time range, and by action type.

### EmailLog

**Purpose:** Records every outbound email send attempt for compliance and deliverability troubleshooting. Each email begins as PENDING, transitions to SENT or FAILED with error details.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | String (cuid) | PK | |
| `to` | String[] | Not null | Recipient addresses |
| `cc` | String[] | Default [] | CC addresses |
| `subject` | String | Not null | |
| `templateName` | String? | Nullable | Template identifier |
| `status` | String | Not null | PENDING, SENT, FAILED |
| `errorMessage` | String? | Nullable | SMTP error message if FAILED |
| `ticketId` | String? | FK → Ticket, nullable | Associated ticket if applicable |
| `messageId` | String? | Nullable | SMTP Message-ID header from response |
| `sentAt` | DateTime? | Nullable | Timestamp of successful delivery |
| `createdAt` | DateTime | Auto | |

**Indexes:** `ticketId`, `status`.

### NotificationPreference

**Purpose:** Per-user opt-in/out settings for each notification event type. Defaults are all-on. Users can disable specific event types (e.g., turn off due date reminders) without losing other notifications.

| Field | Type | Default | Notes |
|---|---|---|---|
| `id` | String (cuid) | PK | |
| `userId` | String | Unique FK → User | One record per user |
| `onAssign` | Boolean | true | Notify when a ticket is assigned to this user |
| `onComment` | Boolean | true | Notify when a comment is added to a ticket they're involved in |
| `onStatusChange` | Boolean | true | Notify when status changes on a relevant ticket |
| `onDueDateRemind` | Boolean | true | Notify when a ticket's due date is approaching |
| `emailEnabled` | Boolean | true | Master switch — disables all email for this user |

---

## 6. Role-Based Access Control (RBAC)

### Philosophy

MegaMTX follows the **principle of least privilege**: every user has exactly the permissions required for their job function and no more. Permissions are never granted implicitly by role hierarchy — they are explicitly listed on each role's `permissions` array. There are no permission inheritance chains. A Supervisor does not automatically inherit Technician permissions; both are explicitly configured.

### System Roles

Six system roles are seeded at deployment time (`isSystem: true`). They cannot be deleted but their descriptions can be updated.

| Role | Description |
|---|---|
| **Super Admin** | Full access to all features including audit logs, email settings, and system configuration. Intended for one or two IT/engineering staff. |
| **Admin** | User management, role assignment, location/asset administration. Cannot view audit logs or change email settings. |
| **Supervisor** | Full ticket lifecycle management including assignment, closing, and exporting reports. Cannot manage users or system settings. |
| **Technician** | Creates and updates tickets they are assigned to. Can add comments and update status. Cannot delete tickets or access reports. |
| **Operator** | Floor-level users who can create corrective tickets and read status updates. Cannot assign, close, or export. |
| **Viewer** | Read-only access to tickets and locations. Intended for QA personnel, managers, or external auditors. |

### Permission Matrix

| Permission | Super Admin | Admin | Supervisor | Technician | Operator | Viewer |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `TICKET_CREATE` | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| `TICKET_READ` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `TICKET_UPDATE` | ✓ | ✓ | ✓ | ✓ | — | — |
| `TICKET_DELETE` | ✓ | ✓ | — | — | — | — |
| `TICKET_ASSIGN` | ✓ | ✓ | ✓ | — | — | — |
| `TICKET_CLOSE` | ✓ | ✓ | ✓ | — | — | — |
| `TICKET_EXPORT` | ✓ | ✓ | ✓ | — | — | — |
| `USER_CREATE` | ✓ | ✓ | — | — | — | — |
| `USER_READ` | ✓ | ✓ | ✓ | — | — | — |
| `USER_UPDATE` | ✓ | ✓ | — | — | — | — |
| `USER_DELETE` | ✓ | ✓ | — | — | — | — |
| `USER_ASSIGN_ROLE` | ✓ | ✓ | — | — | — | — |
| `LOCATION_CREATE` | ✓ | ✓ | — | — | — | — |
| `LOCATION_READ` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `LOCATION_UPDATE` | ✓ | ✓ | — | — | — | — |
| `LOCATION_DELETE` | ✓ | ✓ | — | — | — | — |
| `ASSET_CREATE` | ✓ | ✓ | — | — | — | — |
| `ASSET_READ` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `ASSET_UPDATE` | ✓ | ✓ | — | — | — | — |
| `ASSET_DELETE` | ✓ | ✓ | — | — | — | — |
| `REPORT_VIEW` | ✓ | ✓ | ✓ | — | — | — |
| `REPORT_EXPORT` | ✓ | ✓ | ✓ | — | — | — |
| `ADMIN_PANEL` | ✓ | ✓ | — | — | — | — |
| `AUDIT_LOG_VIEW` | ✓ | — | — | — | — | — |
| `EMAIL_SETTINGS` | ✓ | — | — | — | — | — |

### How Roles Are Enforced

**API layer (middleware):** Every protected route uses `requirePermission(Permission.SOME_PERMISSION)` from `src/middleware/rbac.ts`. The `authenticate` middleware reads the JWT, looks up the user and their role's permissions from the database, and attaches them to `req.user.permissions`. The `requirePermission` middleware then checks that the required permission(s) are present on the request user before the route handler executes. A missing permission returns HTTP 403.

**Frontend UI gating:** The `AuthContext` exposes the current user's permissions array. Components and route guards use a `hasPermission(permission)` helper to conditionally render or hide UI elements (buttons, nav items, entire pages). This is a UX convenience only — the API layer is the authoritative enforcement point.

**Custom roles:** Administrators can create custom roles through `POST /api/users/roles` with any subset of the 25 available permissions. This allows, for example, a `Contractor` role that can only read and update tickets they are assigned to, or a `QA Inspector` role that can read all tickets and create inspections but cannot modify or close them.

---

## 7. Ticket Lifecycle

### State Machine

```
                          ┌─────────────┐
                          │     OPEN    │◄──────────────────┐
                          └──────┬──────┘                   │
                                 │ assign / start work       │
                                 ▼                           │
                         ┌─────────────┐                    │
                         │ IN_PROGRESS │                    │
                         └──────┬──────┘                    │
                    ┌───────────┼───────────────┐           │
                    │           │               │           │
                    ▼           ▼               ▼           │
              ┌─────────┐ ┌──────────┐ ┌────────────────┐  │
              │ ON_HOLD │ │ PENDING_ │ │ PENDING_REVIEW │  │
              └────┬────┘ │  PARTS  │ └───────┬────────┘  │
                   │      └────┬─────┘         │           │
                   └──────────┬┘               │           │
                              ▼                │           │
                         ┌─────────────┐       │           │
                         │ IN_PROGRESS │◄──────┘           │
                         └──────┬──────┘                   │
                                │ mark complete             │
                                ▼                           │
                         ┌─────────────┐                   │
                         │  COMPLETED  │                   │
                         └──────┬──────┘                   │
                                │ formal closure            │
                                ▼                           │
                         ┌─────────────┐                   │
                         │   CLOSED    │                   │
                         └─────────────┘                   │
                                                           │
              CANCELLED ◄──── from any non-CLOSED state ──┘
```

### Status Definitions

| Status | Meaning | Who Can Set | Triggered Actions |
|---|---|---|---|
| **OPEN** | Newly created, not yet in progress | Any user with TICKET_CREATE | StatusHistory entry created; email sent to assignee if pre-assigned |
| **IN_PROGRESS** | Technician is actively working on it | Technician (assigned), Supervisor, Admin | `startedAt` timestamp recorded; StatusHistory entry; email to creator |
| **ON_HOLD** | Work paused, reason required | Technician, Supervisor | StatusHistory entry with reason field required; email to creator |
| **PENDING_PARTS** | Waiting on materials before work can resume | Technician, Supervisor | StatusHistory entry; email notification; future: triggers parts request flow |
| **PENDING_REVIEW** | Work done, awaiting supervisor sign-off | Technician (assigned) | StatusHistory entry; email to supervisor |
| **COMPLETED** | Work confirmed done | Supervisor, Admin | `completedAt` and `completedById` recorded; resolutionNotes captured; AuditLog SIGN if signature required; email to creator and assignee |
| **CLOSED** | Formally closed after review | Supervisor, Admin (TICKET_CLOSE) | `closedAt` and `closedById` recorded; AuditLog entry; ticket is locked |
| **CANCELLED** | Abandoned without completion | Admin, Supervisor | AuditLog entry; reason required; email notification |

### Valid Transitions

| From | To (allowed) |
|---|---|
| OPEN | IN_PROGRESS, CANCELLED |
| IN_PROGRESS | ON_HOLD, PENDING_PARTS, PENDING_REVIEW, COMPLETED, CANCELLED |
| ON_HOLD | IN_PROGRESS, CANCELLED |
| PENDING_PARTS | IN_PROGRESS, CANCELLED |
| PENDING_REVIEW | IN_PROGRESS, COMPLETED, CANCELLED |
| COMPLETED | CLOSED, IN_PROGRESS (re-open if issue found) |
| CLOSED | — (immutable) |
| CANCELLED | — (immutable) |

Attempting an invalid transition returns HTTP 400 with `{ error: "Invalid status transition" }`.

### Ticket Types

| Type | Description |
|---|---|
| **CORRECTIVE** | Reactive maintenance in response to a reported failure or defect. Most common type. |
| **PREVENTIVE** | Scheduled proactive maintenance performed on a defined interval (e.g., monthly filter replacement). Phase 2 adds recurring schedule generation. |
| **INSPECTION** | Formal inspection with pass/fail criteria. Typically requires electronic signature for FDA documentation purposes. |
| **SAFETY** | Safety-critical work orders. These receive elevated visibility and are always defaulted to HIGH or CRITICAL priority. |
| **PROJECT** | Multi-step improvement or installation projects tracked as a single ticket. |

### Priority Levels and SLA Expectations

| Priority | Description | Expected Response | Expected Resolution |
|---|---|---|---|
| **CRITICAL** | Production-stopping failure, safety hazard, or regulatory risk. | Immediate — within 1 hour | Same shift or same day |
| **HIGH** | Significant impact on operations or quality, but not fully production-stopping. | Within 4 hours | Within 24 hours |
| **MEDIUM** | Notable issue with workaround available, or scheduled preventive task. | Within 1 business day | Within 3 business days |
| **LOW** | Minor issue, cosmetic, or long-term improvement. | Within 1 week | Within 2 weeks |

SLA enforcement (automated escalation, overdue alerts) is a Phase 2 feature. The data model (dueDate, priority, status) fully supports it today.

### Ticket Number Format

Ticket numbers are generated in the format `MNT-YYYY-NNNNN` where:
- `MNT` is the prefix, configurable via the `TICKET_NUMBER_PREFIX` environment variable.
- `YYYY` is the four-digit year.
- `NNNNN` is a zero-padded sequential counter per year (resets each January 1).

Example: `MNT-2026-00047`. The counter is calculated from the count of tickets with matching prefix and year, making it sequential without requiring a separate sequence table.

---

## 8. Location & Asset Hierarchy

### Location Model

Locations support **unlimited nesting depth** via a self-referential `parentId` relationship. This allows modeling any organizational physical structure:

```
Plant (root)
├── Building A
│   ├── Floor 1
│   │   ├── Production Line A
│   │   └── Production Line B
│   └── Floor 2
│       └── QC Lab
└── Building B
    └── Utilities Room
```

Every node in this tree is a `Location` record. The root nodes have `parentId: null`. Querying the full subtree of a location requires recursive CTE logic in PostgreSQL, which is supported via Prisma's `$queryRaw` when needed for reporting (rare — most queries filter by a single `locationId`).

**Location codes** (e.g., `MAIN-B1-F2-LINE-A`) are optional but strongly recommended for operations environments where physical locations are referenced in SOPs and maintenance procedures. The code is unique across the system and serves as a human-readable shorthand for the full path.

### Asset Model

Assets are always tied to exactly one location. They are categorized by `AssetCategory` for grouping and filtering. Key fields for operations:

- **`assetTag`**: The value encoded in a physical barcode or QR code affixed to the equipment. Unique across the system. Scanning this tag on a mobile device will identify the asset instantly via `GET /api/assets?assetTag=XXXX`.
- **`qrCode`**: A separate field for QR code payloads if they differ from the barcode (e.g., URL-encoded payloads vs. plain identifiers).
- **`specifications`**: A JSON blob for flexible equipment-specific data (voltage ratings, flow rates, pressure limits) that does not belong in a normalized schema.
- **`installDate` / `warrantyExp`**: Supports preventive maintenance planning and warranty tracking.

### Ticket-to-Location-and-Asset Relationship

Every ticket has a mandatory `locationId` and an optional `assetId`. This allows:
- **Location-only tickets**: Area-level issues (e.g., "Floor drain blocked in Production Area B") where no specific asset is relevant.
- **Asset-specific tickets**: Equipment failures (e.g., "Pump P-101 bearing failure") linked to both the asset and its location.

The location on a ticket is always the actual work location. When an `assetId` is provided, the asset's own `locationId` should match (enforced by validation), but the ticket location is the authoritative field for reporting.

### Asset Maintenance History

All tickets associated with a given asset are queryable via:
```
GET /api/tickets?assetId=<assetId>
```

This returns the full paginated history of corrective, preventive, and inspection tickets for that asset — effectively an equipment maintenance log. Combined with `assetTag` scanning on mobile, technicians can pull up the complete maintenance history of any piece of equipment in the field.

---

## 9. Communication System

### Outbound Email Architecture

All outbound email is sent through **Nodemailer** using a configured SMTP transport. There is no dependency on a third-party email API by default. The SMTP configuration (host, port, credentials, TLS settings) is supplied via environment variables.

The `sendEmail()` function in `emailService.ts` follows a write-first pattern:
1. Create an `EmailLog` record with status `PENDING` before attempting to send.
2. Attempt the SMTP send.
3. Update the `EmailLog` record to `SENT` (with the SMTP `messageId`) on success, or `FAILED` (with the error message) on failure.

Email sends are fire-and-forget from the service layer (called with `.catch(() => {})`) so that an SMTP failure never causes a ticket operation to fail or roll back.

### Email Templates

Three HTML email templates are included, all using a common branded `baseTemplate()` wrapper with the company name and blue header:

| Template | Trigger | Recipients |
|---|---|---|
| **ticket_created** | A new ticket is created | Supervisor group (future); currently ad-hoc |
| **ticket_assigned** | A ticket is assigned (or created with assignment) | The assigned technician |
| **ticket_status_changed** | Any status transition | Ticket creator + assigned technician |

Templates use inline CSS for email client compatibility. Priority badges are color-coded (red for CRITICAL, orange for HIGH, yellow for MEDIUM, green for LOW) and include a prominent "View Ticket" call-to-action button linking to the frontend URL.

### Notification Preferences

Each user has a `NotificationPreference` record controlling which event types trigger emails for them. The master switch is `emailEnabled` — setting this to `false` suppresses all outbound email for that user regardless of other settings. Individual event toggles (`onAssign`, `onComment`, `onStatusChange`, `onDueDateRemind`) allow fine-grained opt-out.

The email service checks `NotificationPreference` before sending. If the preference record does not exist for a user (e.g., new user), defaults to all-on behavior.

### Future: Push Notifications

For mobile clients, push notifications will be delivered via:
- **APNs** (Apple Push Notification service) for iOS devices.
- **FCM** (Firebase Cloud Messaging) for Android devices.

The plan:
1. Mobile apps register a device token on login via `POST /api/devices` (endpoint reserved, not yet implemented).
2. Device tokens are stored against the user in a `DeviceToken` table (Phase 2 model).
3. The notification service sends both email and push for each event, respecting `NotificationPreference`.
4. Push payload mirrors email content: ticket number, title, status, and a deep link to the ticket.

### Future: In-App Notification Center

A `Notification` model will be added to support in-app notifications visible within the web and mobile UIs. Unread count will be surfaced in the navigation header. Users can mark notifications read individually or in bulk.

---

## 10. FDA 21 CFR Part 11 Compliance

21 CFR Part 11 governs the use of electronic records and electronic signatures by FDA-regulated organizations. The following table maps each major requirement to MegaMTX's implementation.

### Subpart B — Electronic Records

| Requirement | Reference | MegaMTX Implementation |
|---|---|---|
| **System validation** | § 11.10(a) | The application is version-controlled in Git. Prisma migrations are deterministic and tracked. A validation protocol (IQ/OQ/PQ) should be executed against the installed system as a site-specific activity. |
| **Audit trail — computer-generated** | § 11.10(e) | The `AuditLog` table is written exclusively by application code (`writeAudit()`). Users cannot directly insert into this table. All timestamps are server-generated (`DateTime @default(now())`). |
| **Audit trail — date/time stamped** | § 11.10(e) | Every `AuditLog` record has a `createdAt` timestamp set by the PostgreSQL server clock, not the client. |
| **Audit trail — operator ID** | § 11.10(e) | Every `AuditLog` record includes `userId` — the authenticated user who performed the action. Login failures record the attempted email in `notes`. |
| **Audit trail — before/after values** | § 11.10(e) | `AuditLog.oldValues` and `newValues` are JSONB columns capturing the state before and after every UPDATE or STATUS_CHANGE. |
| **Record protection** | § 11.10(c) | No `UPDATE` or `DELETE` statements are issued against the `AuditLog` table from application code. Database-level access controls (Postgres roles) should restrict direct `UPDATE`/`DELETE` on this table to DBA-only. |
| **Record retention** | § 11.10(c) | Audit logs are retained for a minimum of 365 days (configurable log rotation policy). Application-level deletion of `AuditLog` records is not implemented. |
| **Access controls — unique user IDs** | § 11.10(d) | Every user has a unique `email` (enforced by database unique constraint) and a unique `id`. Shared accounts are not permitted by design. |
| **Access controls — role-based** | § 11.10(d) | RBAC is enforced on every API endpoint via `requirePermission()` middleware. Roles and permissions are stored in the database and cannot be bypassed via the API. |
| **Authority checks** | § 11.10(g) | The system verifies the user's permission set before executing any operation. JWT claims are verified on every request; the user's current role is loaded from the database. |
| **Sequential use controls** | § 11.10(d) | JWTs expire after 8 hours. Logout writes an audit log entry. Token revocation (future: Redis blocklist) will ensure that stolen tokens can be invalidated. |
| **Terminal / workstation checks** | § 11.10(h) | Not applicable for a web application. Session is bound to the JWT. IP address is captured on login and on all audit log entries. |

### Subpart C — Electronic Signatures

| Requirement | Reference | MegaMTX Implementation |
|---|---|---|
| **Unique to individual** | § 11.100(a) | Each `ElectronicSignature` record is bound to a `userId`. The signature cannot be applied by anyone other than the authenticated user. |
| **Verify identity at time of signing** | § 11.200(a)(1) | Future enhancement: require password re-entry at signature time. Currently, possession of a valid JWT (8-hour expiry) is required. |
| **Non-repudiation — components** | § 11.200(a) | The `ElectronicSignature.hash` is a SHA-256 of `(ticketId + userId + meaning + signedAt + serverSecret)`. This binds the signature to a specific record, user, meaning, and timestamp and cannot be transferred to another record. |
| **Signature meaning** | § 11.50(a) | The `meaning` field is required and must be a full declarative statement (e.g., "I certify that the maintenance described in this ticket was completed in accordance with SOP-MNT-001 and all findings were accurately recorded."). |
| **Signature manifestation** | § 11.50(a) | When displayed in the UI and in exports, the signature renders as: printed name, timestamp, meaning statement, and IP address. |
| **Signature link to record** | § 11.70 | The cryptographic hash links the signature to a specific `ticketId`. Modifying the ticket after signing would invalidate the hash, detectable on verification. |
| **Printed name, date, meaning** | § 11.50(a) | `ElectronicSignature` stores: `user.name` (printed name), `signedAt` (date and time), `meaning` (statement of meaning). All three are rendered in the signature block. |

### Audit Log Immutability Strategy

The `AuditLog` table's immutability is maintained at multiple levels:
1. **Application layer**: The `writeAudit()` function only performs `prisma.auditLog.create()`. No service or route handler calls `prisma.auditLog.update()` or `prisma.auditLog.delete()`.
2. **Database layer** (recommended): A PostgreSQL row-level security policy or trigger should be added in production to reject any `UPDATE` or `DELETE` on the `audit_logs` table from the application database role.
3. **Backup / archival**: For long-term retention beyond 365 days, audit logs should be exported and archived to write-once storage (e.g., S3 with Object Lock, or a separate read-only replica).

---

## 11. API Design

### Base URL and Authentication

- Base URL: `/api`
- All protected routes require: `Authorization: Bearer <jwt_token>`
- Health check (unauthenticated): `GET /api/health`

### Pagination

All list endpoints accept `?page=1&limit=25` query parameters and return:
```json
{
  "data": [...],
  "total": 142,
  "page": 2,
  "limit": 25,
  "totalPages": 6
}
```

Default limit is 25. Maximum limit is 100.

### Error Format

All errors return a consistent JSON body:
```json
{ "error": "Human-readable error message" }
```

| HTTP Status | Meaning |
|---|---|
| 400 | Validation error or bad request |
| 401 | Missing or invalid authentication token |
| 403 | Authenticated but insufficient permissions |
| 404 | Resource not found |
| 409 | Conflict (e.g., duplicate email) |
| 429 | Rate limit exceeded |
| 500 | Unexpected server error |

### Rate Limiting

- **Global**: 200 requests per 15 minutes per IP
- **Auth endpoints** (`/api/auth/login`): 20 requests per 15 minutes per IP

### Routes Reference

#### Auth — `/api/auth`

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/login` | Public | Authenticate with email + password; returns JWT |
| POST | `/logout` | Authenticated | Write audit log; client drops token |
| GET | `/me` | Authenticated | Return current user profile and notification preferences |

#### Tickets — `/api/tickets`

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/` | TICKET_READ | List tickets with filtering and pagination |
| POST | `/` | TICKET_CREATE | Create a new ticket |
| GET | `/:id` | TICKET_READ | Get full ticket detail including comments, history, signatures |
| PATCH | `/:id` | TICKET_UPDATE | Update ticket fields (title, description, priority, assignee, etc.) |
| DELETE | `/:id` | TICKET_DELETE | Soft-delete or hard-delete a ticket |
| PATCH | `/:id/status` | TICKET_UPDATE | Transition ticket status |
| POST | `/:id/comments` | TICKET_UPDATE | Add a comment (public or internal) |
| POST | `/:id/attachments` | TICKET_UPDATE | Upload file attachment (multipart/form-data) |
| POST | `/:id/signatures` | TICKET_UPDATE | Apply an electronic signature |

**Ticket list filters:** `status`, `priority`, `type`, `locationId`, `assetId`, `assignedToId`, `from` (createdAt ≥), `to` (createdAt ≤), `search` (full-text on title, ticketNumber, description).

#### Locations — `/api/locations`

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/` | LOCATION_READ | List all locations (tree or flat) |
| POST | `/` | LOCATION_CREATE | Create a location |
| GET | `/:id` | LOCATION_READ | Get location detail with children |
| PATCH | `/:id` | LOCATION_UPDATE | Update location |
| DELETE | `/:id` | LOCATION_DELETE | Delete location (only if no active assets/tickets) |

#### Assets — `/api/assets`

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/` | ASSET_READ | List assets; filter by `locationId`, `categoryId`, `assetTag` |
| POST | `/` | ASSET_CREATE | Create an asset |
| GET | `/:id` | ASSET_READ | Get asset detail |
| PATCH | `/:id` | ASSET_UPDATE | Update asset |
| DELETE | `/:id` | ASSET_DELETE | Soft-delete asset |

#### Users — `/api/users`

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/` | USER_READ | List users |
| POST | `/` | USER_CREATE | Create user |
| GET | `/:id` | USER_READ | Get user detail |
| PATCH | `/:id` | USER_UPDATE | Update user |
| DELETE | `/:id` | USER_DELETE | Deactivate user |
| PATCH | `/:id/role` | USER_ASSIGN_ROLE | Change user role |
| PATCH | `/:id/preferences` | Authenticated (self) | Update notification preferences |

#### Reports — `/api/reports`

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/summary` | REPORT_VIEW | Ticket counts by status, priority, type |
| GET | `/overdue` | REPORT_VIEW | Tickets past due date |
| GET | `/export` | REPORT_EXPORT | Export tickets to CSV |
| GET | `/audit-log` | AUDIT_LOG_VIEW | Paginated audit log with filters |

---

## 12. Authentication & SSO

### Local Authentication

Local authentication uses email and password. Passwords are hashed with **bcrypt** at a cost factor of 12 rounds before storage. The `passwordHash` field is nullable to support SSO-only users who never set a local password.

**Login flow:**
1. Client sends `POST /api/auth/login` with `{ email, password }`.
2. Server validates the request body (email format, password not empty).
3. User is looked up by email. If not found, or password hash does not match `bcrypt.compare()`, a `LOGIN_FAILED` audit log entry is written and HTTP 401 is returned. The same error message is returned in both cases to prevent user enumeration.
4. If the user's `active` flag is false, HTTP 403 is returned.
5. On success: `lastLoginAt` is updated, a `LOGIN` audit log entry is written, and a signed JWT is returned.

**JWT structure:**
```json
{
  "sub": "<userId>",
  "email": "user@example.com",
  "roleId": "<roleId>",
  "iat": 1234567890,
  "exp": 1234596490
}
```

JWT expiry is 8 hours (`JWT_EXPIRES_IN=8h`). The `authenticate` middleware verifies the token on every request, fetches the user with their role and permissions from the database, and attaches the hydrated user object to `req.user`. This ensures that permission changes take effect within 8 hours without requiring active session invalidation.

### SAML SSO

SAML 2.0 SSO is implemented via `passport-saml`. The system supports both SP-initiated (user goes to login page → redirected to IdP) and IdP-initiated (user launches app from corporate portal) flows.

**Configuration for Azure AD:**
```env
SAML_ENTRY_POINT=https://login.microsoftonline.com/<tenantId>/saml2
SAML_ISSUER=https://your-app.company.com
SAML_CALLBACK_URL=https://your-app.company.com/api/auth/saml/callback
SAML_CERT=<base64 encoded X.509 certificate from Azure AD>
```

**Configuration for Okta:**
```env
SAML_ENTRY_POINT=https://<company>.okta.com/app/<appId>/sso/saml
SAML_ISSUER=https://your-app.company.com
SAML_CALLBACK_URL=https://your-app.company.com/api/auth/saml/callback
SAML_CERT=<base64 encoded X.509 certificate from Okta>
```

On successful SAML assertion:
1. The IdP-provided `nameID` is matched against `User.ssoId`.
2. If found, the user is logged in and a JWT is issued.
3. If not found (first SSO login), a new user record is created with `ssoProvider` set and `passwordHash` left null. The user is assigned the default `Viewer` role; an admin must manually elevate their role.

### Token Refresh (Future)

Currently, tokens are stateless and expire after 8 hours. A refresh token mechanism (long-lived refresh token stored in Redis, short-lived access token) is planned for Phase 2 to improve mobile user experience (no re-login after background time).

### Session Invalidation

Logout (`POST /api/auth/logout`) writes a `LOGOUT` audit log entry. The JWT itself is not server-side invalidated (stateless design). The client is expected to drop the token from storage. For high-security scenarios (e.g., suspected token theft), a Redis-based token blocklist will be added in Phase 2.

---

## 13. Mobile Application Strategy

### The REST API as the Single Source of Truth

The MegaMTX REST API is the single authoritative interface for all clients — web, iOS, and Android. No platform has privileged access; all operations go through the same authenticated REST endpoints. This means the backend evolves once for all clients simultaneously.

### Mobile-Specific API Considerations

**Token storage:**
- iOS: JWT stored in the iOS Keychain (via the `Security` framework or a wrapper like `KeychainSwift`). Never stored in `UserDefaults` or local files.
- Android: JWT stored in the Android Keystore system (via `EncryptedSharedPreferences`). Never stored in plain `SharedPreferences`.

**Device token registration (future):**
When the mobile app receives an APNs or FCM device token, it registers it via:
```
POST /api/devices
Authorization: Bearer <jwt>
{ "platform": "ios" | "android", "token": "<device_token>" }
```
This associates the device token with the authenticated user for push notification targeting.

**Push notification integration plan:**
- iOS: APNs via the `apn` or `node-apn` Node.js package. Requires an Apple Developer account with push notification capability and a `.p8` key file.
- Android: FCM via the `firebase-admin` SDK. Requires a Firebase project linked to the Android app.
- Both platforms' tokens are stored in a `DeviceToken` table (Phase 2). The notification service iterates device tokens per user alongside email sends.

**Offline support:**
- Read-only: Mobile clients cache the last-fetched ticket list and detail pages locally (e.g., SQLite via GRDB on iOS, Room on Android).
- Write queue: Mutations attempted offline are queued locally and replayed on reconnect. Conflict resolution is last-write-wins at the server with a sync timestamp.
- The API design supports this natively — all resources have `updatedAt` timestamps for delta sync.

**Image and attachment upload:**
Mobile apps upload photos (e.g., defect photos taken in the field) via `multipart/form-data` to `POST /api/tickets/:id/attachments`, the same endpoint used by the web client. File size limit is 25 MB. MIME type validation is enforced server-side.

**QR / barcode scanning:**
The native camera is used to scan asset tags. The scanned value is sent to `GET /api/assets?assetTag=<value>`. The returned asset pre-fills the asset field on the ticket creation form, and its linked location pre-fills the location field. This eliminates manual data entry in the field.

### React Native vs Native

The recommendation is **native per platform** (Swift/SwiftUI for iOS, Kotlin/Jetpack Compose for Android) rather than React Native or Flutter, for the following reasons:
- Maintenance workflows involve camera access, offline sync, barcode scanning, and push notifications — all areas where native integration is more reliable and performant.
- Platform-specific UX conventions (iOS navigation patterns vs. Android Material Design) matter for field workers who use these patterns daily.
- The maintenance technician's primary tool is their phone; a suboptimal native experience directly impacts work execution speed.

React Native remains a valid alternative if team capacity is insufficient to maintain two native codebases simultaneously.

### Shared Types

TypeScript types in `frontend/src/types/` will be extracted into a shared `packages/shared-types/` package (Phase 3). This package will be consumed by:
- The backend (for service layer type safety)
- The web frontend
- Any React Native client (if built)

Native Swift/Kotlin clients will maintain their own model layer, but the OpenAPI specification (to be generated from the Express routes in Phase 2) will serve as the contract.

---

## 14. Security Architecture

### HTTP Security Headers

Helmet.js is applied as the first middleware in the Express chain. It sets:
- `Strict-Transport-Security` (HSTS): forces HTTPS for future requests.
- `X-Content-Type-Options: nosniff`: prevents MIME sniffing.
- `X-Frame-Options: DENY`: prevents clickjacking via iframe embedding.
- `Content-Security-Policy`: restricts script, style, and media sources.
- `X-DNS-Prefetch-Control: off`: prevents DNS pre-fetching.
- `Referrer-Policy: no-referrer`: suppresses referrer headers.

### CORS

CORS is restricted to the single `FRONTEND_URL` origin configured via environment variable. `credentials: true` allows the `Authorization` header. Wildcard origins (`*`) are never used in production configuration.

### Input Validation

All mutation endpoints (POST, PATCH, PUT) use `express-validator` to validate and sanitize request bodies before they reach the service layer. Validation rules include:
- String trimming and max-length enforcement.
- Email format normalization.
- Enum value validation against allowed lists.
- Required field presence.

Invalid requests are rejected with HTTP 400 before any database query is executed.

### SQL Injection Prevention

All database access goes through the Prisma client, which uses parameterized queries exclusively. No raw SQL strings with user input are constructed anywhere in the codebase. This completely eliminates the SQL injection attack surface.

### Rate Limiting

Per-IP rate limiting prevents brute-force and denial-of-service attacks:
- Global API limit: 200 requests per 15-minute window.
- Auth login limit: 20 requests per 15-minute window (prevents password brute-force).

The `trust proxy: 1` setting ensures rate limiting uses the real client IP when behind a reverse proxy or load balancer (reading `X-Forwarded-For`).

### File Upload Security

- **MIME type validation**: Uploaded files are validated against an allowlist of accepted MIME types (images, PDFs, common document formats). Files with disallowed MIME types are rejected.
- **Size limit**: Maximum upload size is 25 MB.
- **Storage outside webroot**: Uploaded files are stored in a directory that is not the web root. The Express static file middleware serves files from the `uploads/` directory at `/uploads` — this directory should not be the same as `dist/` or any source directory.
- **Filename sanitization**: Original filenames are not used for storage. A UUID-based filename is generated server-side, and the `originalName` is stored in the database record only for display purposes.

### Secrets Management

All secrets (JWT signing key, database connection string, SMTP credentials, SAML certificate) are supplied via environment variables loaded from a `.env` file. The `.env` file is in `.gitignore` and is never committed. A `.env.example` with placeholder values is committed to document the required variables.

For production, secrets should be injected via a secrets manager (AWS Secrets Manager, Azure Key Vault, HashiCorp Vault) rather than a static `.env` file.

### JWT Security

- Currently HS256 (HMAC-SHA256) with a long random secret.
- **Recommended for production**: RS256 (RSA asymmetric). The signing key (private) is held only by the backend. Verification (public key) can be distributed to any service that needs to verify tokens without exposing the signing capability.
- JWT secret must be at least 256 bits of entropy (32+ random bytes).

---

## 15. Deployment Architecture

### Local Development

```bash
# Start Postgres 16 and Redis 7
docker compose up -d

# Backend
cd backend
cp .env.example .env   # fill in values
npx prisma migrate dev  # apply migrations + generate client
npx prisma db seed     # seed system roles and admin user
npm run dev            # ts-node-dev with hot reload on :3000

# Frontend
cd frontend
npm run dev            # Vite dev server on :5173
```

The backend runs locally (not in Docker) during development for fast TypeScript hot-reloading. The database and Redis run in Docker for consistent versions.

### Production Deployment

1. **Database migrations**: Run `npx prisma migrate deploy` (not `dev`) against the production database before starting the application. Never re-run `db seed` after the first deployment.
2. **Backend**: Build TypeScript (`npm run build`), containerize with a multi-stage Dockerfile, run as a non-root user. Environment variables are injected at runtime.
3. **Frontend**: `npm run build` outputs to `dist/`. Serve via Nginx (for direct hosting) or upload to a CDN (Cloudflare, CloudFront) for global distribution.
4. **Reverse proxy**: Nginx terminates TLS and proxies `/api` to the backend container. Static frontend assets are served directly by Nginx or CDN.

### Environment Variables Reference

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/maintenance_db` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `JWT_SECRET` | HMAC secret for JWT signing | 64+ random hex characters |
| `JWT_EXPIRES_IN` | JWT expiry duration | `8h` |
| `FRONTEND_URL` | Web app origin (for CORS and email links) | `https://maintenance.company.com` |
| `SMTP_HOST` | SMTP server hostname | `smtp.company.com` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username | `maintenance@company.com` |
| `SMTP_PASS` | SMTP password | _(secret)_ |
| `EMAIL_FROM_NAME` | Sender display name | `ACME Maintenance` |
| `EMAIL_FROM_ADDRESS` | Sender email address | `maintenance@company.com` |
| `COMPANY_NAME` | Used in email templates | `ACME Corp` |
| `TICKET_NUMBER_PREFIX` | Prefix for ticket numbers | `MNT` |
| `UPLOAD_DIR` | Directory for file uploads | `uploads` |
| `PORT` | Backend listen port | `3000` |
| `SAML_ENTRY_POINT` | IdP SSO URL | _(IdP-specific)_ |
| `SAML_ISSUER` | SP entity ID | `https://maintenance.company.com` |
| `SAML_CALLBACK_URL` | SAML assertion consumer URL | `https://maintenance.company.com/api/auth/saml/callback` |
| `SAML_CERT` | IdP X.509 certificate | _(base64)_ |

### Log Retention Policy

| Log Type | Retention | Storage |
|---|---|---|
| Application logs (Winston) | 30 days | Rotating daily files, auto-deleted after 30 days |
| Audit logs (PostgreSQL `AuditLog` table) | 365 days minimum | Database; archive to write-once storage for long-term |
| Email logs (PostgreSQL `EmailLog` table) | 90 days | Database; older records can be archived or pruned |

The 365-day minimum audit log retention satisfies FDA 21 CFR Part 11 and typical cGMP record-keeping requirements. Organizations with longer required retention periods (e.g., 3 or 7 years) should archive `AuditLog` records to long-term storage before pruning.

### Backup Strategy

- **PostgreSQL WAL archiving**: Configure continuous WAL archiving to object storage (S3, Azure Blob) for point-in-time recovery.
- **Daily base backups**: `pg_dump` or a managed backup service for daily snapshots.
- **Restore testing**: Backups should be restored to a test environment quarterly to verify recoverability.
- **Redis**: Redis data (`redis_data` Docker volume) is for caching and session data only. It does not need the same backup rigor as Postgres, but the volume should be included in infrastructure snapshots.

---

## 16. Development Conventions

### Naming Conventions

- **TypeScript identifiers**: camelCase for variables, functions, and object properties.
- **TypeScript types and interfaces**: PascalCase.
- **Database columns**: Prisma maps camelCase TypeScript fields to snake_case PostgreSQL columns automatically. Do not add explicit `@map` annotations unless the name genuinely differs.
- **Environment variables**: UPPER_SNAKE_CASE.
- **File names**: `camelCase.ts` for source files, `PascalCase.tsx` for React components.
- **API routes**: lowercase kebab-case paths (e.g., `/api/audit-log`).

### Error Handling

- **Operational errors** (predictable business logic failures): Throw `AppError(httpStatus, message)`. The `errorHandler` middleware catches these and returns the appropriate HTTP response.
- **Unexpected errors** (programming errors, network failures): Let them propagate to `errorHandler`, which logs the full stack trace and returns a generic HTTP 500 `{ error: "Internal server error" }` without leaking implementation details to the client.
- Never throw raw `new Error()` from service layer code; always use `AppError` so the HTTP status is explicit.

### Service Layer Rules

- **All business logic lives in `src/services/`**. Route handlers are thin: validate input, call a service function, return the result.
- **Every mutation calls `writeAudit()`**. This is a hard rule — any PR that adds a create/update/delete operation without an audit write will be rejected in code review.
- **No raw SQL**. All database access goes through `prisma.*` methods. The one exception is complex recursive location tree queries, which may use `prisma.$queryRaw` with tagged template literals (which are still parameterized).
- **No `any` in the service layer**. TypeScript strict mode is enabled. Any use of `any` in `src/services/` is a build warning and will be addressed before merge.

### Audit Discipline

The `writeAudit()` function signature is:
```typescript
writeAudit({
  userId?: string,
  action: AuditAction,
  resource: string,
  resourceId?: string,
  oldValues?: object,
  newValues?: object,
  ipAddress: string,
  userAgent: string,
  notes?: string,
})
```

The `ipAddress` and `userAgent` are injected by the `auditMeta` middleware (attached to `req.auditMeta`) so they are always available in route handlers and passed down to service functions.

### Git Workflow

- **Branching**: Feature branches are created off `main` with the convention `feat/<description>`, `fix/<description>`, `docs/<description>`, `chore/<description>`.
- **Merge strategy**: Squash merge to `main`. Each feature results in a single clean commit on main.
- **Commit messages**: Follow Conventional Commits format: `type(scope): description`.
- **No force-push to main**.
- **TypeScript must compile clean** before a PR can be merged. No `tsc --noEmit` errors.
- **Prisma schema changes** must include a generated migration file in `prisma/migrations/`.

---

## 17. Future Roadmap

### Phase 1 — Foundation (Current)

The current state of MegaMTX. Everything documented above is implemented or immediately implementable from the existing scaffold.

- Core ticket CRUD with full lifecycle management (OPEN → CLOSED / CANCELLED)
- Role-based access control with 6 system roles and 25 permissions
- Append-only audit logging for every mutation and authentication event
- Outbound email notifications via Nodemailer/SMTP
- Location hierarchy (unlimited nesting depth)
- Asset registry with barcode/QR code fields
- Electronic signature model (schema and API endpoint)
- JWT authentication (local) and SAML SSO scaffold
- React web frontend with ticket list, detail view, creation form, and dashboard
- Docker Compose infrastructure (Postgres 16 + Redis 7)

### Phase 2 — Operations

The next major development phase, prioritized for maximum operational value:

- **Preventive maintenance schedules**: Define recurring PM schedules (daily, weekly, monthly, custom cron) that auto-generate tickets on their due date. Requires a `PMSchedule` model and a job runner (Bull queue via Redis).
- **File attachments (UI)**: Frontend for uploading and viewing photos and documents on tickets. Backend endpoint exists; frontend UI is Phase 2.
- **Electronic signatures (UI)**: Signature capture modal with password confirmation on ticket completion. Full Part 11 signature flow in the UI.
- **Dashboard KPIs**: Charts showing open ticket count by priority, tickets closed per week, average resolution time, overdue count. Export to CSV and PDF.
- **Push notifications**: Device token registration, APNs and FCM integration, per-user push preference settings.
- **In-app notification center**: Notification feed in the web header, unread count badge, mark-read functionality.
- **SLA overdue detection**: Background job that scans for tickets past `dueDate` and sends escalation emails.

### Phase 3 — Scale

Longer-horizon features that require Phase 1 and 2 to be fully stable:

- **Native iOS app**: Swift + SwiftUI. Full ticket lifecycle, camera-to-attachment upload, APNs push, QR asset scanning, offline read cache, write queue with sync.
- **Native Android app**: Kotlin + Jetpack Compose. Same feature set as iOS, adapted for Android UX conventions. FCM push notifications.
- **QR code scanning in the field**: Native camera integration for asset identification. Scan → auto-fill ticket form with asset and location.
- **Barcode scanner for parts**: Scan parts during repair, log materials used on a ticket. Future: link to ERP inventory for stock-level visibility (read-only).
- **Offline-first mobile with sync queue**: Full offline support — create tickets and comments offline, queue mutations, replay on reconnect with conflict resolution.
- **SLA escalation engine**: Configurable escalation chains — if a CRITICAL ticket is not IN_PROGRESS within 1 hour, notify the supervisor; after 2 hours, notify the plant manager. Powered by Bull queues and configurable rules per priority.
- **Parts and inventory linking (read-only)**: Integration with external ERP system (SAP, Oracle, NetSuite) to display spare parts availability on the ticket detail page. No write-back — MegaMTX is not an inventory system.
- **Multi-site support**: Site-scoped access control allowing a single MegaMTX instance to serve multiple manufacturing sites, with users restricted to their assigned site's locations, assets, and tickets.
- **Azure AD SSO (full production)**: Complete SAML configuration guide, automated user provisioning from Azure AD groups to MegaMTX roles, and certificate rotation procedures.
- **OpenAPI specification**: Auto-generated OpenAPI 3.0 spec from Express routes (via `zod-to-openapi` or `tsoa`), enabling SDK generation for native clients and third-party integrations.

---

*This document reflects the system as designed and scaffolded. It should be updated as each phase ships. All architectural decisions documented here represent the current technical consensus and should not be changed unilaterally — open a discussion or ADR before departing from any pattern described in this reference.*
