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
- Classification rules implemented per spec:
  - AL_RAWA → Global Forum = **EXPENSE**
  - Global Forum → AL_RAWA = **INCOME**
  - AL_RAWA ↔ Cash = **Internal Transfer** (no income/expense effect)
- **Deposit Remaining** tracking: shows how much cash needs to be deposited to bank
- Finance Reports tab with 6 sub-reports (Headwise Income/Expense, Monthly Income/Expense, Audit, Yearly AGM)
- PDF generation and print support for all reports
- **Accessories Fee** added as global fee (one entry = default for all students)
- **Defaulter tab** with month-by-month grid for recurring fees, yearly for one-time fees
- **Fee Assignment tab** for special fees (Hifz Tuition, Hifz Admission, Transport) with toggle per student
- **Transaction Cancellation** — admin/accountant can cancel transactions with reason; creates a reversal entry
- **Duplicate fee prevention** — server rejects creating same student + category + feeMonth twice (409)
- **Income "Deposit To" dropdown** — can now deposit to Cash in Hand (default) or AL RAWA Bank
- **Global Forum balance** now visible in finance UI (3 account cards)
- **Server-side date filtering** on getTransactions endpoint

### 3. User Management
- Admin panel for managing user roles (admin, teacher, accountant, viewer)
- Role-based permission system (finance:read/write, students:read/write, etc.)
- Accountant role gets finance access only

### 4. Firebase Migration Script
- Complete rewrite with proper class key mapping (`classToKey()`)
- Handles all data: classes, subjects, students, results, teachers, staff, books
- Dry-run mode: `npx tsx server/src/scripts/migrate.ts --dry-run`

### 5. School Logo
- Logo added to app header, online report card, and PDF report cards
- Stored as base64 constant in `client/src/lib/logo.ts`

### 6. Modular File Extraction
- **IdCardSection** and **ResultSection** split into dedicated sub-components
- `IdCardSection.tsx` reduced to a **thin routing shell** (~41 lines)
- `ResultSection.tsx` reduced to a **thin routing shell** (~38 lines)

### 7. Results Sub-Components (`client/src/pages/results/`)
- **Enter by Subject** — bulk marks entry, attendance, comments
- **Enter by Student** — per-student marks with auto-save (500ms debounce), live GPA/grade/rank
- **Tabulation Tab** — landscape A4 PDF tabulation sheets
- **All Report Cards** — batch PDF generation for all students
- **Online Report Card** — in-browser preview before PDF download

### 8. Grading Library (`client/src/lib/grading.tsx`)
- Shared grading logic: `getGrade`, `gradeFromMarks`, `gpaToGrade`, `calcTermRanks`, `calcYearRanks`, `calcAttendPct`

### 9. Report Card PDF (`client/src/lib/reportPdf.ts`)
- Professional PDF with photo, grade chips, signatures
- Term and Annual modes, supports shared doc for batch generation

### 10. Shared Components & Utilities
- **ClassSelect** — reusable class dropdown
- **Contact Links** — Bangladeshi phone formatting + WhatsApp links

### 11. Excel Import for Finance (`client/src/pages/ExcelImportTab.tsx`)
- Full-featured Excel import with flexible column parsing
- Smart student resolution (class+roll, roll-only fallback)
- Duplicate fee detection (409 handling)
- Preview table with inline editing, select/deselect, error panel

### 12. Defaulter Report (Server)
- Comprehensive per-student fee tracking via `GET /api/finance/defaulter`
- Skips fees with 0 default amount (no ghost rows)

### 13. Fee Assignment System
- Toggle special fees per student (Hifz Tuition, Hifz Admission, Transport)

---

## Latest Session Additions

### 14. WHAT-TO-IMPROVE Fixes (14 Items)

#### Critical Fixes
- **#1 Balance calc** — Replaced `findMany()` + JS loop with `$queryRaw` SQL aggregate (single query)
- **#2 Income destination** — Added "Deposit To" dropdown (default Cash, optional AL RAWA Bank)
- **#3 saveStudentResult** — Wrapped in `prisma.$transaction` for atomicity
- **#4 Defaulter ghost rows** — Skips fees with `defaultAmt <= 0`
- **#5 Attendance** — Don't save `{days:0, present:0}`, treat as not-entered

#### Serious Fixes
- **#6 Zod validation** — Added `validate.ts` with schemas for createTransaction, saveStudentResult
- **#7 Store type** — Added missing `comment` parameter to `saveStudentResult` type
- **#9 Server-side filtering** — `getTransactions` now accepts `dateFrom`, `dateTo`, `type` query params
- **#10 Global Forum balance** — Added third balance card to finance UI
- **#15 Duplicate fee prevention** — Server checks studentId+category+feeMonth before create (409)

#### Code Quality
- **#12-13 PDF extraction** — Created `financeReportPdf.ts`, `defaulterPdf.ts`, `tabulationPdf.ts`
- **#16 Excel duplicate check** — Handles 409 errors gracefully, shows "duplicates skipped"
- **#17 getState() fix** — Removed `useSchoolStore.getState()` bypass in ExcelImportTab
- **#18 confirm() replacement** — Created `DeleteConfirmModal` component, updated 5 files

### 15. AGM Report Policy Compliance
- **Income & Expenditure Statement** — all income/expense categories listed (not just top 5)
- **Balance Sheet** — AL RAWA Bank, Global Forum, Cash in Hand balances
- **Receipts & Payments Statement** — opening/closing balances, total received/paid
- **Signatures** — Finance Director, Managing Director, Chairman (policy-compliant)

### 16. Inline Card Editing (Student/Teacher/Staff)
- Replaced top collapsible form with **inline card editing**
- **Add New** card appears first in grid (violet border, always in edit mode)
- **Edit** card expands inline with **blue border + blue tint**
- **View** card shows info normally with Edit/Delete buttons
- Click photo → opens CameraModal to change image
- Save/Cancel buttons inside the card
- No more scrolling to separate form at top of page

### 17. Swipe-Back Navigation
- **Swipe right** (80px+ threshold) on mobile goes back one step
- Added `swipeBack` + `registerSwipeBack` to UI store
- **Finance**: swipe from Reports → Transactions (first tab)
- **Result**: swipe from Tabulation → Enter by Subject (first tab)
- **ID Card**: swipe from Teachers/Staff → Students (first sub-tab)
- Swipe from any first tab → Dashboard

### 18. CameraModal — Front/Back Camera Flip
- Added `RotateCw` flip button to toggle between front (`user`) and back (`environment`) camera
- Replaced `alert()` with toast for camera errors

### 19. Zod Validation (All Controllers)
- Added `createTeacherSchema`, `createStaffSchema`, `createBookSchema` to `validate.ts`
- Applied validation to **6 endpoints**: student create/update, teacher create/update, staff create/update, book create/update
- All return 400 with descriptive error messages on invalid input

### 20. Browser Back Button / Deep Linking
- Dashboard now syncs `activeMode` with URL search params (`?mode=finance`, `?mode=result`, etc.)
- Layout back button and swipe-back also update URL params
- Browser back/forward now works correctly
- Deep linking supported: `/?mode=finance`, `/?mode=result`, etc.

### 21. Loading Skeletons
- Created `Skeleton.tsx` with reusable components: `Skeleton`, `CardSkeleton`, `TableSkeleton`, `BalanceCardSkeleton`
- Added `loading` state to `SchoolStore` (tracks loading for classes, students, teachers, staff, books, finance, transactions)
- Each `fetch*` function now sets loading true/false with try/finally
- StudentSection, TeacherSection, StaffSection show 6 skeleton cards while data loads

### 22. Server-Side Filtering
- `fetchTransactions` now accepts optional `params` object
- FinanceReports can pass `dateFrom`, `dateTo`, `type` to filter server-side
- No more loading ALL transactions when only a date range is needed

---

## Fixes Applied

### Finance Reports
- **Fixed Monthly Income/Expense PDF** — flat date-sorted list with running total (no category grouping)
- **Fixed academic year filter** — was inverted, now correctly shows Sep year-1 to Aug year
- **Cancelled transactions excluded from reports** — both `isCancelled` and `reversalOfId` filtered
- **Removed taka sign (৳)** — replaced with `/-` suffix across all PDFs and HTML tables

### Report Cards
- **Fixed missing `calcAttendPct` import** — was causing crash in reportPdf.ts
- **Fixed logo in report cards** — base64 data URI now stripped correctly for jsPDF
- **Fixed OnlineReportCard logo** — was using missing `/logo.png`, now uses `SCHOOL_LOGO` constant

### Transaction Cancellation
- **Fixed cancel 400 error** — `param()` function didn't exist, replaced with `req.params.id`
- **Cancellation now creates reversal entry** — swapped accounts, atomic via `$transaction`
- **Cancelled rows show in ledger** — strikethrough + CANCELLED badge + cancel reason
- **Reversal rows show in ledger** — purple REVERSAL badge, purple tint, auto-generated
- **getBalances excludes cancelled** — `is_cancelled = false` in SQL query
- **Mandatory reason** — both client (button disabled) and server (400 if empty)
- **CancelledBy shows user name** — resolved via userMap lookup from user management store

### Database Schema
- Added `reversalOfId` field + index to Transaction model
- Added `FeeAssignment` model for special fees
- Added 8 performance indexes on Transaction
- Added cascade rules on Subject, Book, Result

### Server Security
- Rate limiting: 500 req/15min global, 20 req/15min auth
- Auth middleware on photo endpoints
- Sanitized error messages
- JSON body limit reduced to 2MB

---

## Git History (This Session)
```
e56c7c4 feat: loading skeletons + store loading states + server-side filtering params
0bde5ee fix: Zod validation on all controllers + browser back button deep linking
6217145 docs: update SESSION-NOTES.md with all work from this session
c785e4c feat: inline card editing, swipe-back navigation, camera flip
9c547a0 feat: AGM report — Balance Sheet, Receipts/Payments, all income/expense heads
8c203d9 feat: add swipe-right-to-go-back gesture on mobile
6da79a4 fix: report card PDF — missing calcAttendPct import, logo base64, toast type
cc6c313 fix: online report card logo — use SCHOOL_LOGO constant
fa2bb28 fix: WHAT-TO-IMPROVE items — 14 fixes (critical + serious + code quality)
638077b docs: expand Excel Import documentation
3f7816f feat: modular architecture, grading library, report PDF, Excel import
```

## Known Issues (Remaining)
- `node_modules/` not tracked in git
- Photos kept as BYTEA in PostgreSQL (~13MB for 500 photos)

### ~~Fixed This Session~~
- ~~Zod validation not yet added to all controllers~~ ✅ Added to student, teacher, staff, book controllers
- ~~Browser back button still broken~~ ✅ Deep linking via URL search params (?mode=finance)
- ~~No loading skeleton for data fetches~~ ✅ Created Skeleton.tsx with CardSkeleton, TableSkeleton, BalanceCardSkeleton
- ~~Finance reports use client-side filtering~~ ✅ fetchTransactions now accepts server-side params (dateFrom, dateTo, type)
