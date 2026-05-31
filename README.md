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
- Search & filter by class/roll
- Paginated API

### Teachers & Staff
- CRUD with inline card editing
- Photo capture
- PDF list with photos
- Designation/role filtering

### Results
- Enter marks **by Subject** (bulk) or **by Student** (individual)
- Auto-save with 500ms debounce
- Live GPA, grade, and rank calculation
- Term (1st, 2nd, Final) and **Annual Result** (averaged)
- **Tabulation sheet** PDF (landscape A4)
- **Report cards** — online preview + batch PDF download
- Subjects with configurable full marks

### Finance
- Double-entry accounting with 3 accounts: **AL RAWA Bank**, **Global Forum Bank**, **Cash in Hand**
- Ledger with transaction history
- **6 Report tabs:** Headwise Income/Expense, Monthly Income/Expense, Audit, Yearly AGM
- AGM report: Income/Expenditure Statement, Balance Sheet, Receipts & Payments
- **Opening balances** per fiscal year (user-settable, full history with revert)
- **Fee assignments** — Hifz Tuition, Hifz Admission, Transport (toggle per student)
- **Defaulter report** — month-by-month fee tracking
- **Excel import** with flexible column mapping
- CSV + Excel + PDF export on all reports
- **Transaction cancellation** with reversal entries

### ID Cards
- Print ID cards for students, teachers, and staff

### User Management
- Roles: admin, teacher, accountant, viewer
- Role-based permissions (finance:read/write, students:read/write, etc.)
- Email verification on registration

### PWA
- Installable on mobile/desktop
- Offline-ready service worker (caches static assets, bypasses API)

### Dark Mode
- Toggle sun/moon in header
- Persisted to localStorage
- Full Tailwind dark variant support

### Mobile
- Collapsible table → stacked card layout on small screens
- Swipe-right gesture for back navigation
- Responsive grid layouts throughout

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
- `DATABASE_URL` — PostgreSQL connection string
- `BETTER_AUTH_URL` — Frontend URL (e.g. `http://localhost:5173`)
- `BETTER_AUTH_SECRET` — Auth signing secret
- `RESEND_API_KEY` — Email verification (Resend)
- `CORS_ORIGINS` — Comma-separated allowed origins

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
├── client/          # React frontend (Vite)
│   └── src/
│       ├── components/  # Shared UI (Toast, Skeleton, Camera, etc.)
│       ├── lib/         # Utilities (grading, PDF, contacts, config)
│       ├── pages/       # Route pages
│       │   ├── results/ # Results sub-components
│       │   ├── students/
│       │   ├── teachers/
│       │   └── staff/
│       └── store.ts     # Zustand state management
├── server/          # Express backend
│   └── src/
│       ├── controllers/ # Route handlers
│       ├── lib/         # Auth, validation, errors, permissions
│       └── middleware/  # Auth middleware
└── index.html
```
