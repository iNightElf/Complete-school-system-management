# Development Session Notes

## What We Built

### 1. Results System (Complete Rewrite)
- Migrated from Firebase Realtime DB to PostgreSQL (Prisma)
- Redesigned from drill-down navigation to **4-tab layout**: Enter by Subject, Enter by Student, Tabulation, Report Cards
- Fixed critical `sid()` vs UUID mismatch — old Firebase synthetic IDs (e.g. `r2026101`) never matched DB UUIDs, breaking ALL result lookups
- Fixed `getClassResults` API to return flat `Result[]` instead of nested `students[].results[]`
- Subject serial order preserved from Firebase (added `order` field, fixed 16 out-of-order subjects)
- Removed 20 duplicate Subject records, added `@@unique([name, classId])` constraint
- Bulk report cards now download as **single multi-page PDF** (was separate files)
- Report card PDF restored to old design: navy summary bar, side-by-side attendance+comment, 3 signature lines

### 2. Finance System
- 3 accounts: AL RAWA Bank, Global Forum, Cash in Hand
- Income always goes to **Cash in Hand** (no deposit destination option)
- Classification rules implemented per spec:
  - AL_RAWA → Global Forum = **EXPENSE**
  - Global Forum → AL_RAWA = **INCOME**
  - AL_RAWA ↔ Cash = **Internal Transfer** (no income/expense effect)
- Global Forum removed from Expense "Pay From" options (only used for loans)
- **Deposit Remaining** tracking: shows how much cash needs to be deposited to bank
- Finance Reports tab with 6 sub-reports (Headwise Income/Expense, Monthly Income/Expense, Audit, Yearly AGM)
- PDF generation and print support for all reports
- **Accessories Fee** added as global fee (one entry = default for all students)
- **Defaulter tab** with month-by-month grid for recurring fees, yearly for one-time fees
- **Fee Assignment tab** for special fees (Hifz Tuition, Hifz Admission, Transport) with toggle per student

### 3. User Management
- Admin panel for managing user roles (admin, teacher, accountant, viewer)
- Role-based permission system (finance:read/write, students:read/write, etc.)
- Accountant role gets finance access only

### 4. Firebase Migration Script
- Complete rewrite with proper class key mapping (`classToKey()`)
- Handles all data: classes, subjects, students, results, teachers, staff, books
- Dry-run mode: `npx tsx server/src/scripts/migrate.ts --dry-run`
- Properly maps Firebase `contactNumber` → Prisma `contact`, `discountedPrice` → `discounted`
- Sets subject order from Firebase array index

### 5. School Logo
- Logo added to app header, online report card, and PDF report cards
- Stored as base64 constant in `client/src/lib/logo.ts`

---

## Fixes Applied (This Session)

### Finance Reports
- **Fixed Monthly Income/Expense PDF crash** — `setTextColor` was passing arrays `[22, 101, 52]` instead of individual args `22, 101, 52`. jsPDF threw `Invalid argument passed to f3`
- **Removed taka sign (৳) from all reports** — replaced with `/-` suffix across all PDFs and HTML tables
- **Rewrote Monthly PDF** — portrait A4 with individual transaction rows (Date, Class/Student, Category, Amount, Running total) instead of the old month matrix
- **Monthly live tables** now show Date, Category, Description, Amount per transaction (was category×month matrix)
- **Defaulter PDF + Print** — landscape PDF with colored fee badges, ✓/✗ boxes for paid/unpaid months, grand totals
- **Defaulter shows all students** even with no payments (all fees marked as unpaid/due)
- **Deposit Remaining fix** — Global Forum → AL RAWA transfers no longer inflate deposit remaining (bank-to-bank doesn't count as cash needing deposit)
- **Added Class + Student fields** to income transaction form — stored in `Transaction.className` and `Transaction.studentId`

### Database Schema
- Added `studentId` and `className` to `Transaction` model
- Added `FeeAssignment` model for special fees (hifz_tuition, hifz_admission, transport)
- **Added 8 indexes on Transaction**: studentId, category, className, transactionDate, transactionType, and composite indexes for common query patterns
- **Added indexes on**: Student.class, Subject.classId, Book.classId, Result.studentId, FeeAssignment.[active, studentId]
- **Added FK relations**: Transaction → Student (onDelete: SetNull), FeeAssignment → Student (onDelete: Cascade)
- **Added cascade rules**: Subject → SchoolClass, Book → SchoolClass, Result → Student (all onDelete: Cascade)
- Removed redundant manual `deleteMany` calls in deleteClass and deleteStudent (cascade handles it)

### Server Security
- **Added auth middleware** to 3 photo endpoints (students, teachers, staff) — were publicly accessible
- **Fixed `req.user?.userId`** → `req.session?.user?.id` in finance controller (audit trail was broken)
- **Added rate limiting** — 500 req/15min global, 20 req/15min for auth endpoints
- **Reduced JSON body limit** from 10MB → 2MB
- **Single shared PrismaClient** — was creating 7 separate instances (wasted DB connections)
- **Sanitized error messages** — no more Prisma schema leaks to clients (new `lib/errors.ts` helper)
- **Removed duplicate code block** in defaulter report (one-time fees were processed twice, causing double-counting)

### Client
- **ErrorBoundary** — wraps entire app, prevents blank screen on runtime crashes
- **Store error handling** — all 8 `fetch*` functions now have try/catch (no unhandled promise rejections)
- **Removed unused imports** — `useCallback` and `FileText` from IdCardSection, `useNavigate` from Register
- **useEffect cleanup** — Toast setTimeout cleared on unmount, DefaulterTab uses AbortController for stale fetches, ResultSection saves timer cleared on unmount
- **Photos loaded on-demand** — list APIs return `hasPhoto: true/false` instead of base64 (was ~10MB response, now ~50KB). Photos fetched via `/api/:type/:id/photo` endpoint when needed
- **PDF generation** fetches photos on-demand via photo API before generating

---

## Known Issues

### ⚠️ Concurrent Marks Entry — DATA LOSS
- **Symptom**: When multiple teachers enter marks for the same class simultaneously, one teacher's edits get overwritten
- **Root cause**: `saveStudentResult` replaces the entire `marks` JSON column. Auto-save sends the full marks object every 500ms. After save, `loadResults()` refetches and a useEffect resets the form, overwriting in-progress typing
- **Proposed fix** (not yet implemented):
  1. Client sends only changed subjects, not entire marks object
  2. Server merges marks: `{ ...existing.marks, ...newMarks }` instead of replacing
  3. Remove `allResults` from useEffect dependency (preforms form reset during typing)
  4. Don't refetch after auto-save, only after manual save or student change

### Other Notes
- Subject order fix script (`fix-subject-order.ts`) was created, run, then deleted — order should persist in DB
- The old Firebase app's `js/results.js` and other legacy files are kept for reference only
- `node_modules/` is not tracked in git
- **Zod input validation** not yet implemented on server controllers (zod is installed but unused)
- **ResultSection.tsx** (1066 lines) and **IdCardSection.tsx** (806 lines) should be split into smaller files
- Photos stored as BYTEA in PostgreSQL — consider object storage (S3/R2) for better performance at scale
