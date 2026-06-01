# AL RAWA English School — School Management System

A full-featured school management system for **AL RAWA English School** (Bangladesh). Manages students, teachers, staff, results, finance, books, and ID cards.

## Tech Stack

- **Frontend:** React 19 + TypeScript 6 + Vite + Tailwind CSS v4 + Zustand
- **Backend:** Node.js + Express + TypeScript + Prisma ORM
- **Database:** PostgreSQL
- **Auth:** Better Auth (email/password + email verification)
- **PWA:** Service worker + manifest.json (installable)
- **PDF:** jsPDF + jspdf-autotable
- **Excel:** xlsx (SheetJS)

## Features

### Students
- CRUD with inline card editing
- Photo capture via camera
- PDF list with photos
- Global search by name/roll/class
- Soft delete with 7-second undo
- Archive (graduate) per-student and per-class
- Active/All toggle for archived students
- Bulk CSV import

### Teachers & Staff
- CRUD with inline card editing
- Photo capture
- PDF list with photos
- Soft delete with 7-second undo
- Bulk CSV import

### Results
- Enter marks **by Subject** (bulk) or **by Student** (individual)
- Auto-save with 500ms debounce + `beforeunload` unsaved-changes warning
- Live GPA, grade, and rank calculation
- Term (1st, 2nd, Final) and **Annual Result** (averaged)
- **Tabulation sheet** PDF (landscape A4)
- **Report cards** — online preview + batch multi-page PDF download
- Subjects with configurable full marks

### Finance
- Double-entry accounting with 3 accounts: **AL RAWA Bank**, **Global Forum Bank**, **Cash in Hand**
- Ledger with transaction history (all 3 account balances visible)
- **6 Report tabs:** Headwise Income/Expense, Monthly Income/Expense, Audit, Yearly AGM
- AGM report: Income/Expenditure Statement, Balance Sheet, Receipts & Payments
- **Opening balances** per fiscal year (user-settable, full history with revert)
- **Fee assignments** — Hifz Tuition, Hifz Admission, Transport (toggle per student)
- **Defaulter report** — month-by-month fee tracking
- **Excel import** with flexible column mapping
- CSV + Excel + PDF export on all reports
- **Transaction cancellation** with reversal entries
- Configurable fiscal year start month

### ID Cards
- Print ID cards for students, teachers, and staff

### User Management
- Roles: admin, teacher, accountant, viewer
- Role-based permissions (finance:read/write, students:read/write, etc.)
- Email verification on registration
- Audit log with entity/action filters

### Error Handling
- 404 page for unknown routes
- ErrorBoundary wrapping entire app
- P2025 → proper 404 responses (was 400)
- 401 interceptor — auto-redirects to login on expired sessions
- Neon DB cold start handled with retry endpoint

### PWA
- Installable on mobile/desktop
- Offline-ready service worker (caches static assets, bypasses API)

### Dark Mode
- Toggle sun/moon in header
- Persisted to localStorage
- Full Tailwind dark variant support

### Mobile
- Collapsible table → stacked card layout on small screens (`.mobile-card-table`)
- Swipe-right gesture for back navigation
- Responsive grid layouts throughout
- Soft keyboard Enter submits edit forms
- Escape closes modals

## Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL 15+

### Setup

```bash
# 1. Clone and install
git clone <repo>
cd schoolid
npm install
cd server && npm install
cd ../client && npm install

# 2. Configure environment
cp server/.env.example server/.env
# Edit server/.env with your DATABASE_URL, BETTER_AUTH_URL, etc.

# 3. Run migrations
cd server
npx prisma migrate dev

# 4. Start
npm run dev  # runs both server (port 5000) and client (port 5173)
```

### First Run
1. Open `http://localhost:5173`
2. Register an account — the **first user** is automatically made **admin**
3. Add classes, subjects, students, then start recording results and transactions

## Environment Variables

See `server/.env.example` for all required variables:
- `DATABASE_URL` — PostgreSQL connection string (Supabase, Neon, or any PostgreSQL)
- `BETTER_AUTH_URL` — Frontend URL (e.g. `http://localhost:5173`)
- `BETTER_AUTH_SECRET` — Auth signing secret
- `RESEND_API_KEY` — Email verification (Resend)
- `CORS_ORIGINS` — Comma-separated allowed origins

---

## Supabase Deployment

This app runs on Supabase with **zero code changes**. See `MIGRATE-TO-SUPABASE.md` for full instructions.

**What changes:**
- `DATABASE_URL` — point to your Supabase direct connection string
- `docker-compose.yml` — already configured without local PostgreSQL (uses Supabase cloud)
- Everything else stays the same — Prisma, Better Auth, all features

**Why Supabase:**
- Managed PostgreSQL with automated backups
- Free tier: 500 MB DB, 50k monthly active users
- No cold starts (unlike Neon free tier)
- Built-in dashboard for tables, SQL editor, user management

## Backup & Restore

### Backup (PostgreSQL)

```bash
# Using pg_dump
pg_dump -U schoolid -h localhost schoolid > backup_$(date +%Y%m%d_%H%M%S).sql

# With docker-compose
docker exec schoolid-postgres pg_dump -U schoolid schoolid > backup.sql
```

### Restore

```bash
# Drop and recreate the database first
psql -U schoolid -h localhost -c "DROP DATABASE IF EXISTS schoolid;"
psql -U schoolid -h localhost -c "CREATE DATABASE schoolid;"

# Restore from dump
psql -U schoolid -h localhost schoolid < backup.sql

# With docker-compose
docker exec -i schoolid-postgres psql -U schoolid schoolid < backup.sql
```

### Schedule (cron example)

```bash
# Run daily at 3 AM — adjust paths as needed
0 3 * * * pg_dump -U schoolid -h localhost schoolid > ~/backups/schoolid_$(date +\%Y\%m\%d).sql
```

## Project Structure

```
schoolid/
├── client/                  # React frontend (Vite + TypeScript 6)
│   └── src/
│       ├── components/      # Shared UI (Toast, Skeleton, Camera, ImportModal, etc.)
│       ├── lib/             # Utilities (config, types, grading, PDF, contacts)
│       ├── pages/           # Route pages
│       │   ├── results/     # EnterBySubject, EnterByStudent, OnlineReportCard, etc.
│       │   ├── students/    # StudentSection
│       │   ├── teachers/    # TeacherSection
│       │   └── staff/       # StaffSection
│       ├── store.ts         # Zustand state management
│       └── App.tsx          # Router + ErrorBoundary
├── server/                  # Express backend (TypeScript + Prisma)
│   └── src/
│       ├── controllers/     # Route handlers (student, ops, result, finance, etc.)
│       ├── lib/             # Auth, validation, errors, permissions, finance-rules
│       ├── middleware/      # Auth middleware (authenticate, authorizePermission)
│       └── server.ts        # Entry point
├── DEPLOYMENT.md
├── ROADMAP.md
└── WHAT-TO-IMPROVE.md
```
