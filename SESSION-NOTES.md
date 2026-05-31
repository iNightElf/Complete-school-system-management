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
- **Transaction Cancellation** — admin/accountant can cancel transactions with reason; cancelled transactions show in audit trail
- **Class + Student fields** on transactions — optional class/student/fee month on income transactions
- **Ledger** — paginated transaction list (25/page) with date range and type filters
- **Monthly reports** now show individual transaction rows (Date, Class/Student, Category, Amount, Running Total) grouped by category
- **Audit Report** — full financial year summary with audit certificate + 3 signature lines
- **Yearly AGM** — annual general meeting report with financial overview, top 5 income/expense heads, internal transfers summary, recommendations

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

## New Additions (Latest Session)

### 6. Modular File Extraction
- **IdCardSection** and **ResultSection** were monolithic files — split into dedicated sub-components for maintainability
- `IdCardSection.tsx` reduced to a **thin routing shell** (~41 lines) that renders sub-components based on tab selection
- `ResultSection.tsx` reduced to a **thin routing shell** (~38 lines) that delegates to 4 sub-components

#### Student Management (`client/src/pages/students/StudentSection.tsx`)
- Extracted from `IdCardSection.tsx` into its own dedicated file
- Class picker grid — view students by class with student counts
- Student CRUD — create, edit, delete students with collapsible form
- Photo upload via `PhotoUpload` + `CameraModal` components
- Search by name or roll number
- PDF export of student list with photos (fetches photos on-demand)
- Edit/delete buttons — admin-only role gate via `useAuthStore`

#### Teacher Management (`client/src/pages/teachers/TeacherSection.tsx`)
- Extracted from `IdCardSection.tsx` into its own dedicated file
- Teacher CRUD — create, edit, delete teachers
- Designation filter — pill-based filter by unique designations
- Search by name or designation
- Photo upload + on-demand photo fetching
- PDF export of teacher list with photos
- Contact links — phone + WhatsApp via shared utility

#### Staff Management (`client/src/pages/staff/StaffSection.tsx`)
- Extracted from `IdCardSection.tsx` into its own dedicated file
- Staff CRUD — create, edit, delete staff (role/designation based)
- Search by name or role
- Photo upload + on-demand photo fetching
- PDF export of staff list with photos
- Contact links — phone + WhatsApp via shared utility

### 7. Results Sub-Components (`client/src/pages/results/`)

#### Enter by Subject (`EnterBySubject.tsx`)
- Bulk marks entry view: Select class → subject → term
- Spreadsheet-like table with marks/grade/GPA per student
- Bulk attendance entry (days + present) per term
- Bulk teacher's comment entry (always for term 3)
- Auto-grade chips via `gradeFromMarks()`
- Admin-only save buttons
- Marks merge on save (doesn't overwrite other subjects)

#### Enter by Student (`EnterByStudent.tsx`)
- Per-student marks entry view: Select class → student → term
- Full marks entry form with auto-save (500ms debounce)
- Live GPA/grade/rank calculation
- Attendance section per term
- Teacher's comment section
- **Online Report Card** button → preview before PDF download
- Photo display for each student
- Term rank calculation via `calcTermRanks()`

#### Tabulation Tab (`TabulationTab.tsx`)
- Generates landscape A4 PDF tabulation sheets
- Student name → all subjects → total/GPA/grade/rank columns
- Supports per-term or "Final Combined" (averages across 3 terms)
- Auto page breaks when rows exceed page height
- Dynamic column widths based on subject count

#### All Report Cards Tab (`AllReportCardsTab.tsx`)
- Batch PDF generation: Select class → download 1st Term, 2nd Term, or Annual Result for ALL students
- Creates a single multi-page PDF with all students
- Uses `downloadReportCardPDF()` with shared jsPDF document

#### Online Report Card (`OnlineReportCard.tsx`)
- In-browser preview of report cards (term or annual)
- Student info, photo, marks table with grades/GPAs
- Summary bar (GPA, Grade, Rank)
- Attendance table (multi-term for annual)
- Teacher's comment section
- 3 signature lines (Class Teacher, Co-ordinator, Principal)
- PDF download button

### 8. Grading Library (`client/src/lib/grading.tsx`)
- Shared grading logic extracted for reuse across all result components
- `getGrade(pct)` — percentage → grade + GPA (A+ to F scale)
- `gradeFromMarks(obtained, fullMarks)` — marks-based grading
- `gpaToGrade(gpa)` — GPA → grade letter
- `gradeColor(g)` / `gradeChip(g)` — Tailwind color classes for grades
- `calcTermSummary()` — per-student term GPA, total marks
- `calcTermRanks()` — class ranking by GPA then total marks
- `calcYearSummary()` — annual GPA from 3-term averages
- `calcYearRanks()` — annual class ranking
- `calcAttendPct()` — attendance percentage

### 9. Report Card PDF (`client/src/lib/reportPdf.ts`)
- Professional PDF generation for individual report cards
- Fetches student photo on-demand via `/api/students/:id/photo`
- School logo + header with badge
- Student info section (name, class, roll, parents)
- **Term mode**: single-term marks table → grade chips → GPA → rank
- **Annual mode**: 3-term marks + average → grade → GPA → year rank
- Side-by-side attendance + teacher's comment
- 3 signature lines
- `_pdfGradeChip()` helper for colored grade badges
- Supports `sharedDoc` for multi-student batch PDFs

### 10. Shared Components & Utilities

#### ClassSelect (`client/src/components/ClassSelect.tsx`)
- Reusable dropdown component for selecting a class
- Fetches classes from store on mount, sorted by `order` field
- Returns full class object on selection

#### Contact Links (`client/src/lib/contacts.tsx`)
- `formatBDPhone()` — normalizes Bangladeshi phone numbers to +880 format
- `contactLinks()` — renders clickable phone link + WhatsApp link

### 11. Excel Import for Finance (`client/src/pages/ExcelImportTab.tsx`, 417 lines)
- **Full-featured Excel import** for bulk financial transactions
- Parses `.xlsx/.xls/.csv` via `xlsx` npm package
- **Flexible column parsing** — accepts multiple aliases per field:
  - Class: `Class`, `class`, `ClassName`
  - Roll: `Roll`, `roll`, `Roll No`, `rollNo`, `RollNo`, `roll_no`
  - Category: `Category`, `category`, `Cat`
  - Token: `Token`, `token`, `Ref`, `ref`
  - Fee Month: `Fee Month`, `feeMonth`, `fee_month`, `Month`
- **Excel date parsing** — handles numeric serial dates (e.g. `45678` → `2025-01-15`) and string dates
- **Type normalization** — accepts `income`, `inc`, `i`, `1` as income; everything else defaults to expense
- **Smart student resolution** — resolves by class+roll first, falls back to roll alone (roll is globally unique)
- **Auto re-resolve** — when students store updates, unresolved rows automatically re-attempt resolution
- **Upload summary toast** — shows row count, resolved student count, and column names detected
- **Category-aware validation** — student fee categories (Tuition, Admission, Books, etc.) require roll and resolved student
- **Preview table** with:
  - Select/deselect all or individual rows
  - Row count + selected count + valid count in toolbar
  - Inline editing: date picker, category dropdown (income/expense split), type toggle, amount, class, roll, fee month
  - Delete individual rows
  - Color-coded rows: red background for errors, green/red badges for income/expense
  - Resolved student name shown for student fee rows; "not found" shown for unresolved rolls
- **Error panel** — lists all rows with validation errors (first 10 + overflow count), skipped during import
- **Batch import** — imports all valid selected rows sequentially via `POST /api/finance/transactions`
- **Auto-clear** — clears table on full success; keeps rows if any failures for retry

### 12. Defaulter Report (Server)
- Comprehensive per-student fee tracking via `GET /api/finance/defaulter`
- Recurring fees (monthly): Tuition, Hifz Tuition, Transport
- Special recurring fees: from `FeeAssignment` model
- One-time fees (yearly): Admission, Hifz Admission, Books, Copy, Stationary
- Global fees: Accessories Fee (same amount for all students)
- Month-by-month paid/unpaid tracking
- Class-level default amounts (last paid by any student in class)

### 13. Fee Assignment System
- **Server**: `GET /api/finance/fee-assignments`, `POST /api/finance/fee-assignments/toggle`, `PUT /api/finance/fee-assignments/:id`
- Toggle special fees (Hifz Tuition, Hifz Admission, Transport) per student
- `FeeAssignment` model: unique constraint on `[studentId, feeType]`, cascade delete with Student

---

## Fixes Applied

### Finance Reports
- **Fixed Monthly Income/Expense PDF crash** — `setTextColor` was passing arrays `[22, 101, 52]` instead of individual args `22, 101, 52`. jsPDF threw `Invalid argument passed to f3`
- **Removed taka sign (৳) from all reports** — replaced with `/-` suffix across all PDFs and HTML tables
- **Rewrote Monthly PDF** — portrait A4 with individual transaction rows (Date, Class/Student, Category, Amount, Running total) instead of the old month matrix
- **Monthly live tables** now show Date, Category, Description, Amount per transaction (was category×month matrix)
- **Defaulter PDF + Print** — landscape PDF with colored fee badges, ✓/✗ boxes for paid/unpaid months, grand totals
- **Defaulter shows all students** even with no payments (all fees marked as unpaid/due)
- **Deposit Remaining fix** — Global Forum → AL RAWA transfers no longer inflate deposit remaining (bank-to-bank doesn't count as cash needing deposit)

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
- **`xlsx` dependency** added to client for Excel import parsing

---

## Known Issues

### ~~Concurrent Marks Entry — DATA LOSS~~ ✅ FIXED
- **Server**: `saveStudentResult` now merges marks (`{ ...existing.marks, ...newMarks }`) instead of replacing the entire JSON column
- **Client**: Removed `allResults` from useEffect dependency — changed to `allResults.length` so form only re-populates when result count changes (new student result), not on every auto-save refetch
- **Client**: Auto-save no longer calls `loadResults()` after save. Manual "Save Marks" button still refetches to confirm
- **Note**: EnterBySubject tab already used `allResults.length` and manual saves only, so no change needed

### Other Notes
- Subject order fix script (`fix-subject-order.ts`) was created, run, then deleted — order should persist in DB
- The old Firebase app's `js/results.js` and other legacy files are kept for reference only
- `node_modules/` is not tracked in git
- **Zod input validation** not yet implemented on server controllers (zod is installed but unused)
- Photos kept as BYTEA in PostgreSQL (~13MB for 500 photos, well within Neon free tier)
