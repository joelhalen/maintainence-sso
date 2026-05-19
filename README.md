# MegaMTX — Maintenance Management System

A cloud-ready maintenance ticket and asset tracking system for operations, facilities, and manufacturing teams. MegaMTX supports both managed cloud tenancy with subscription-based entitlements and self-hosted deployments for teams that need direct infrastructure control.

Supports FDA 21 CFR Part 11 audit trail requirements out of the box, with Microsoft SSO scaffolding, mobile push notifications, and ingress/egress email functionality.

## Stack

| Layer     | Technology |
|-----------|-----------|
| Backend   | Node.js · TypeScript · Express · Prisma ORM |
| Database  | PostgreSQL 16 |
| Frontend  | React · TypeScript · Vite · Tailwind CSS |
| Auth      | JWT · optional SAML SSO (Azure AD, Okta, etc.) |
| Messaging | SMTP email · Firebase Cloud Messaging (push) |
| Mobile    | Capacitor 6 (iOS + Android native shell) |

---

## Quick Start

### 1. Configure environment

```bash
cp backend/.env.example backend/.env
# Set at minimum: DATABASE_URL, JWT_SECRET
# Set SMTP_* values to enable email notifications
# Set FIREBASE_* values to enable push notifications
# Set COMPANY_NAME to customise the UI label
```

### 2. Start PostgreSQL

**Docker Compose (recommended):**
```bash
docker compose up -d
```

**Native PostgreSQL (Debian/Ubuntu):**
```bash
sudo apt install -y postgresql
sudo -u postgres psql -c "CREATE DATABASE maintenance_db;"
sudo -u postgres psql -c "CREATE USER postgres WITH PASSWORD 'password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE maintenance_db TO postgres;"
# Update DATABASE_URL in backend/.env to match
```

### 3. Install, migrate, and seed

```bash
cd backend
npm install
npm run db:migrate   # create tables
npm run db:seed      # create default roles + admin user
```

### 4. Start the backend

```bash
npm run dev          # port 4000
```

### 5. Start the frontend

```bash
cd ../frontend
npm install
npm run dev          # port 5173  (proxies /api → backend)
```

> Open ports 5173 and 4000 in your firewall for external access.
> On Debian/Ubuntu: `sudo ufw allow 5173 && sudo ufw allow 4000`

**Default admin credentials:** `admin@megamtx.local` / `Admin@123!`
Change this immediately after first login.

---

## Production Deployment

Build the frontend and let the backend serve it as static files:

```bash
# 1. Build the React app
cd frontend && npm run build

# 2. Run the backend in production mode
cd ../backend
npm run build
NODE_ENV=production node dist/server.js
```

The Express server automatically serves `frontend/dist` and handles client-side routing when `NODE_ENV=production`.

### With PM2

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # enable auto-start on reboot
```

---

## Mobile (iOS / Android)

MegaMTX uses **Capacitor 6** with a **bundled** web build (not a remote WebView). The APK talks to your server via `VITE_API_URL` (default `https://megamtx.joelhalen.net/api`).

### One-time: Android SDK on the build server

```bash
sudo ./scripts/install-android-sdk.sh
source /etc/profile.d/android-sdk.sh
```

### Build APK and publish for download

```bash
./scripts/build-android-apk.sh
# → releases/megamtx-latest.apk
# → https://megamtx.joelhalen.net/download_apk  (after nginx config)
```

Override API URL for staging:

```bash
VITE_API_URL=https://staging.example.com/api ./scripts/build-android-apk.sh
```

### Local development with Android Studio

```bash
cd frontend
npm install
npm run build:capacitor
npx cap sync android
npx cap open android
```

**Push notifications** need Firebase: set `FIREBASE_*` on the backend and add `google-services.json` under `frontend/android/app/`.

See `frontend/.env.capacitor.example` and `deploy/nginx-megamtx.conf`.

### In-app updates (Android sideload)

On launch, the native app checks `GET /api/app/version` against the installed `versionCode`. When a newer APK is published, users see an update screen that **downloads and opens the installer automatically** (one confirmation tap in Android).

```bash
./scripts/build-android-apk.sh   # bumps versionCode, updates releases/build-info.json
```

Force older clients to update before use:

```bash
APP_MIN_VERSION_CODE=3 ./scripts/build-android-apk.sh
```

Store URLs (`APP_PLAY_STORE_URL`, `APP_APP_STORE_URL`) are reserved for a future Play/App Store flow.

### Platform admin: mobile release dashboard

Platform admins can manage versions and trigger APK builds at **Platform → Mobile App** (`/platform/mobile-release`):

- Edit **version name**, **current version code**, and **minimum version code** (live immediately for all installed apps)
- Set APK / store URLs without redeploying code
- **Build & publish APK** runs `scripts/build-android-apk.sh` on the server (requires Android SDK)

Settings are stored in `backend/data/mobile-release-config.json`.

---

## Initial Setup (after first login)

1. **Create locations** — go to Locations and add your facility, buildings, or zones.
2. **Create asset categories** — go to Assets → Categories and define the types relevant to your operation (e.g. *Production Equipment*, *Lab Instruments*, *Electrical*, *Utilities*).
3. **Add assets** — register your equipment under the appropriate category and location.
4. **Invite users** — go to Users, create accounts, and assign roles.
5. **Review subscription usage** — go to Subscription to see the current organization, plan limits, PayPal billing scaffold, and usage meters.

---

## Roles & Permissions

| Role        | Home screen    | Tickets | Assets | Locations | Users | Reports |
|-------------|---------------|---------|--------|-----------|-------|---------|
| Super Admin | Dashboard      | Full    | Full   | Full      | Full  | Full    |
| Admin       | Dashboard      | Full    | Full   | Full      | Full  | Full    |
| Supervisor  | Dashboard      | Full    | R/W    | Read      | Read  | View    |
| Technician  | Action landing | R/W     | Read   | Read      | —     | —       |
| Operator    | Action landing | R/Create| Read   | Read      | —     | —       |
| Viewer      | Action landing | Read    | Read   | Read      | —     | —       |

**Dashboard** (analytics + charts) is shown to roles with `REPORT_VIEW`. All other roles see an **action landing page** with quick-access buttons for viewing and creating tickets.

Navigation items are hidden automatically when a user lacks the required permission — users only see what they can act on.

---

## Organizations & Subscription Entitlements

MegaMTX is tenant-aware for cloud hosting. Users, roles, locations, assets, tickets, logs, signatures, and notification records are scoped to an organization. RBAC still controls what an individual user can do, while the organization's subscription plan controls product limits and feature availability.

Seeded plans include `FREE`, `STARTER`, `PROFESSIONAL`, and `ENTERPRISE`. The free plan has caps for active users, locations, assets, and active tickets; higher tiers expand or remove those caps. PayPal provider fields are present for future checkout and webhook integration, but live billing is intentionally scaffolded only in this pass.

---

## Key Features

- **Ticket lifecycle** — OPEN → IN_PROGRESS → PENDING_PARTS / PENDING_REVIEW → COMPLETED → CLOSED with full status history
- **Asset management** — track equipment with serial numbers, warranty dates, and maintenance history
- **Location hierarchy** — nested sites, buildings, and zones
- **Role-based access control** — 26 granular permissions assignable per role
- **Organization tenancy and subscriptions** — plan-based limits for users, locations, assets, active tickets, push, SSO, and exports
- **Audit trail** — append-only log of every action (supports 21 CFR Part 11)
- **Electronic signatures** — cryptographic sign-off on ticket completion
- **Email management** — SMTP egress, super-admin test/log views, IMAP ingress polling, and ticket reply threading
- **Push notifications** — Firebase Cloud Messaging (FCM) for iOS, Android, and web; per-user preferences; push log with delivery tracking
- **Mobile apps** — Capacitor 6 native shell for iOS and Android; registers device tokens automatically on sign-in
- **File attachments** — photos and documents on tickets
- **Export** — CSV / JSON ticket export
- **SAML SSO** — optional Azure AD / Okta integration via `SAML_*` env vars

---

## Environment Variables (key settings)

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | required |
| `JWT_SECRET` | Secret for signing tokens | required |
| `JWT_EXPIRES_IN` | Token lifetime | `8h` |
| `FRONTEND_URL` | CORS allowed origin | `http://localhost:5173` |
| `TICKET_NUMBER_PREFIX` | Prefix for ticket IDs | `MNT` |
| `COMPANY_NAME` | Display name in UI | — |
| `SMTP_HOST/PORT/USER/PASS` | Email delivery | — |
| `EMAIL_REPLY_DOMAIN` / `EMAIL_REPLY_LOCAL_PART` | Reply-to address generation for ticket threading | — |
| `IMAP_*` | Inbound mailbox polling for received/reply emails | — |
| `DEFAULT_ORGANIZATION_ID` | Fallback organization for unmatched inbound mail | — |
| `FIREBASE_PROJECT_ID` | Firebase project for FCM push notifications | — |
| `FIREBASE_PRIVATE_KEY` | Firebase service account private key | — |
| `FIREBASE_CLIENT_EMAIL` | Firebase service account email | — |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Full service account JSON (alternative to above three) | — |
| `PAYPAL_*` | PayPal billing placeholders for future checkout/webhooks | — |
| `SAML_*` | SSO configuration | — |

Full variable list: `backend/.env.example`

---

See `docs/MegaMTX-Design-Reference.md` for architecture details.
