# MegaMTX — Maintenance Management System

An FDA 21 CFR Part 11 compliant maintenance ticket creation and management system. Replaces third-party CMMS/MaintainX licensing with a fully in-house solution, providing enhanced operator visibility and control.

## Stack
- **Backend:** Node.js + TypeScript + Express + Prisma + PostgreSQL
- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Future:** Native iOS + Android apps (shared REST API)

## Quick Start
```bash
cp backend/.env.example backend/.env   # configure env vars
docker compose up -d                    # start Postgres + Redis
cd backend && npm install && npm run db:migrate && npm run db:seed
cd ../frontend && npm install && npm run dev
```

Default admin: `admin@megamtx.local` / `Admin@123!`

See `docs/MegaMTX-Design-Reference.md` for full architecture documentation.
