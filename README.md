# MegaMTX — Maintenance Management System

An FDA 21 CFR Part 11 compliant maintenance ticket creation and management system. Replaces third-party CMMS/MaintainX licensing with a fully in-house solution, providing enhanced operator visibility and control.

## Stack
- **Backend:** Node.js + TypeScript + Express + Prisma + PostgreSQL
- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Future:** Native iOS + Android apps (shared REST API)

## Quick Start

### 1. Configure environment
```bash
cp backend/.env.example backend/.env
# Edit backend/.env and set DATABASE_URL, JWT_SECRET, SMTP_* values
```

### 2. Start PostgreSQL

**Docker Compose v2 (modern):**
```bash
docker compose up -d
```

**Docker Compose v1 (older installs — `docker-compose` as separate command):**
```bash
docker-compose up -d
```

**No Docker — native PostgreSQL (Debian/Ubuntu):**
```bash
sudo apt install -y postgresql
sudo -u postgres psql -c "CREATE DATABASE maintenance_db;"
sudo -u postgres psql -c "CREATE USER postgres WITH PASSWORD 'password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE maintenance_db TO postgres;"
# Update DATABASE_URL in backend/.env to match your credentials
```

### 3. Install dependencies & run migrations
```bash
cd backend
npm install
npm run db:migrate
npm run db:seed
```

### 4. Start the backend
```bash
npm run dev   # runs on port 4000
```

### 5. Start the frontend

**Local access only (localhost:5173):**
```bash
cd ../frontend && npm install && npm run dev
```

**Exposed on all interfaces (access from other devices/home PC):**
```bash
cd ../frontend && npm install && npm run dev
# Vite now binds to 0.0.0.0 by default — access via http://<server-ip>:5173
```

> **Note:** Open port 5173 (and 4000 for the API) in your firewall if accessing externally.
> On Debian: `sudo ufw allow 5173 && sudo ufw allow 4000`

---

Default admin: `admin@megamtx.local` / `Admin@123!`

See `docs/MegaMTX-Design-Reference.md` for full architecture documentation.
