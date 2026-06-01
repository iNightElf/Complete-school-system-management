# ROADMAP — All Items Complete

All items identified during full codebase audits have been fixed. **Zero TypeScript errors, zero lint errors, 74/74 tests passing.**

---

## ✅ Phase 1 — Production Polish (May 31, 2026)

### Opening Balance Calculation
- Stored opening balances per fiscal year per account (`OpeningBalance` model)
- User-settable via UI (defaults to 0 for new schools)
- AGM report uses stored balances instead of flawed formula
- Full change history with undo/revert (`OpeningBalanceHistory` model)

### Server-side Pagination
- `getAllStudents`, `getAllTeachers`, `getAllStaff`, `getAllBooks` accept `skip`/`take`
- Response includes `{ data, total, skip, take }`

### Configurable Fiscal Year
- Centralized `FISCAL_YEAR_START_MONTH` in `client/src/lib/config.ts`
- All labels and filter logic use the config value

### Infrastructure
- `.env.example` with all required env vars and documentation
- CORS origins read from `CORS_ORIGINS` env var, fallback to localhost
- Gzip compression on all API responses
- Google Fonts via `<link>` with preconnect (was `@import`)

### Performance
- **N+1 query fix** — `getAllClasses` uses single `groupBy` instead of per-class COUNT
- **Route code splitting** — `React.lazy` + `Suspense` on all 5 routes
- **Vite manualChunks** for vendor libs (react, jspdf, xlsx, framer-motion)
- **Photo caching** — `Cache-Control: public, max-age=86400` + ETag with `304 Not Modified`

### UI/UX
- **Dashboard redesign** — gradient welcome banner, time-based greeting, stat cards, module tiles with hover arrows
- **Loading skeletons** — book list, defaulter report, period close, card skeletons
- **Mobile card layout** — `.mobile-card-table` CSS collapses tables to stacked cards on screens < 640px
- **Dark mode** — Tailwind `@custom-variant dark`, CSS overrides, `useDarkMode` store with localStorage
- **Icon polish** — All emoji → lucide-react icons (~20 files), redesigned Login/Register with gradient backgrounds
- **Page transitions** — Framer Motion keyed on `location.pathname` in Layout
- **`lastFetched` timestamp** — shown in footer
- **Keyboard shortcuts** — Escape closes modals, Enter submits edit forms

### PWA
- `manifest.json`, service worker with install + cache, SW registration in `main.tsx`
- SVG favicon (no PNG generator needed)

---

## ✅ Phase 2 — Neon DB & Cold Start (May 31, 2026)

- **`waitForDatabase()`** retry loop in server startup (15 tries, 2s apart)
- **`GET /api/wake-db`** endpoint (20 retries, 1.5s apart) called by frontend on mount
- `/health` endpoint reports `connected` / `connecting` DB status
- **`sanitizeError()`** with friendly messages for 6 Prisma error codes
- Global error handler uses `sanitizeError()` in production, raw in dev

---

## ✅ Phase 3 — Soft Delete & Undo (May 31, 2026)

- **`deletedAt`** field on `Student`, `Teacher`, `Staff` — all GET endpoints filter `deletedAt: null`
- **Restore endpoints** — `POST /api/students/:id/restore`, `/api/teachers/:id/restore`, `/api/staff/:id/restore`
- **Undo toast** — 7-second undo window after delete for students, teachers, staff
- **`graduatedAt`** field on `Student` — multi-year archive support
- **Graduate/ungraduate** — per-student and per-class graduation
- **Active/All toggle** — show/hide graduated students
- **Import** — CSV bulk import for students, teachers, staff via shared `ImportModal`
- **8 new integration tests** for soft-delete and restore flows

---

## ✅ Phase 4 — Full Codebase Audit (June 1, 2026)

### Round 1 — Critical & High (10 issues)

| Area | Fix |
|------|-----|
| `saveStudentResult` | Wrapped in `prisma.$transaction` + marks merge guarded against empty object |
| `getAllStudents` | Added `classId` to response (was missing) |
| `verifySMTP` | Wrapped in try-catch (was unhandled promise rejection) |
| P2025 errors | Return **404** instead of **400** across 26 catch blocks |
| Migration script | Parameterized hardcoded path (`process.argv[2]`) |
| Shared constants | `API_URL` + `TERM_NAMES` moved to `src/lib/config.ts`, **removed from 22 files** |
| TypeScript types | Added `Student`, `Teacher`, `Staff`, `SchoolClass`, `Subject`, `Result`, `Transaction`, `Balance` interfaces in `src/lib/types.ts` |
| Auth | **401 interceptor** on axios (redirects to login), `document.title` on **all 14 pages** |
| 404 page | Added `NotFound.tsx` component (was silent redirect to `/`) |
| `bulkAssign` race | Wrapped in `prisma.$transaction` (was `Promise.allSettled` without isolation) |
| `confirm()` | Replaced with `DeleteConfirmModal` in `StudentSection` |
| `console.debug` | Removed 6 instances from production code |
| `DataTable` | Added `error` prop (was showing "No data" on API failure) |

### Round 2 — Medium & Low (18 issues)

| Area | Fix |
|------|-----|
| `deleteClassResults` | Renamed, added separate `deleteClassSubjects` endpoint |
| `fiscalYear` type | Fixed `String` → `Int` mismatch between `OpeningBalance` and `PeriodClose` |
| `Student.classRel` | Added `onDelete: SetNull` (was orphan on class delete) |
| `authorize` middleware | Removed (unused, `authorizePermission` used everywhere) |
| Raw SQL dedup | Extracted duplicate balance calculation into `accountBalancesSql()` helper |
| `user.controller` import | Changed from `../lib/auth.js` to `../lib/prisma.js` (fragile re-export) |
| `deleteFeeSchedule` | Returns **200** with body (was **204** no content, inconsistent with all other deletes) |
| `getStudentResults` | Added student existence check (was missing, no 404) |
| `INTERNAL_ACCOUNTS` | Deduplicated between `validate.ts` and `finance-rules.ts` |
| Unused `React` imports | Removed from **17 files** (React 19 auto-jsx transform) |
| "Lock App" button | Relabeled to "Logout" |
| Book deletion undo | Added undo toast (was missing) |
| `beforeunload` | Added unsaved-changes warning on `EnterByStudent` and `EnterBySubject` |
| `sm:hide-scrollbar` | Replaced with proper `.scrollbar-hide` CSS utility (was undefined class) |
| `jsonwebtoken` dep | Removed from `package.json` (unused, Better-Auth handles JWTs) |
| Fee schedule delete test | Updated from 204 → 200 expectation |
| Balance test mocks | Updated from `$queryRaw` → `$queryRawUnsafe` |

### Remaining Known Issues (Won't Fix / Deferred)
- `role` and `transactionType` stored as plain strings, not enums (would require migration + type changes)
- Photos stored as `BYTEA` in PostgreSQL (would require object store migration)
- No pagination controls exposed in UI (server supports `skip`/`take`)
- Finance reports filter transactions in JavaScript, not SQL
- `FinanceReports.tsx` is a single 500+ line component

---

## ✅ All Tests Passing

- **74/74** Vitest integration + unit tests
- **2/2** Playwright E2E tests
- **Zero** TypeScript errors (`tsc --noEmit` on client + server)
- **Zero** ESLint errors
