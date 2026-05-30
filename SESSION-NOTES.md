# Development Session Notes — May 30, 2026

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

## Known Issues

### ⚠️ Monthly Income/Expense PDF — NOT WORKING
- **Symptom**: Clicking PDF download on Monthly Income or Monthly Expense tabs does nothing (no file downloads)
- **Root cause**: The `addLogo` function passes a ~50KB base64 data URI to jsPDF's `doc.addImage()`, which corrupts the PDF stream and prevents `doc.save()` from working
- **Attempted fix**: Stripped the `data:image/jpeg;base64,` prefix before passing to jsPDF — still not working
- **Status**: UNRESOLVED — needs further investigation. Other PDFs (headwise, audit, AGM) also use the same `addLogo` and may have the same issue
- **Temporary workaround**: Headwise Income/Expense PDFs appear to work because they render plain HTML tables. The issue is specifically with `doc.addImage()` + large base64 strings in jsPDF

### Other Notes
- Subject order fix script (`fix-subject-order.ts`) was created, run, then deleted — order should persist in DB
- The old Firebase app's `js/results.js` and other legacy files are kept for reference only
- `node_modules/` is not tracked in git
