# DeepSeek AI Code Review — AL RAWA English School Management System

**Grade: A-**

A comprehensive automated review of the codebase by DeepSeek AI.

---

## Summary

Production-ready school management system built on React 19 + Express 5 + Prisma 6 + PostgreSQL 17. Clean monorepo architecture, strong security posture, and solid DevOps. The main gaps are frontend test coverage, some TypeScript discipline issues, and a handful of medium-severity bugs in the UI layer.

---

## Architecture — A

- Clean client/server monorepo with well-defined separation of concerns
- Controllers, middleware, lib utilities, and routes are logically organized
- Dual-app design (legacy vanilla JS + modern React) is unusual but the modern app stands on its own
- State management via Zustand is appropriate for this scale

## Code Quality — A-

- Consistent patterns: Zod validation, sanitized errors, audit logging, soft deletes
- Business logic cleanly extracted (`finance-rules.ts`, `fiscal-year.ts`, `grading.tsx`)
- Error handling is mature: `sanitizeError` prevents Prisma schema leaks, `ErrorBoundary` wraps the app, 401 interceptor auto-redirects
- Controllers follow a uniform try/catch pattern with appropriate HTTP status codes

**Demerits:**
- `catch { /* silent */ }` in store.ts swallows errors — hard to debug
- `finance.controller.ts` (780 lines) mixes period close, reconciliation, defaulter reports, AGM reports — should be split
- `accountBalancesSql` uses string interpolation for dates instead of parameterized queries (low risk since dates are internally generated, but a code smell)

## Testing — B+

- 602-line integration test with mocked Prisma covering auth, permissions, CRUD, finance logic
- Unit tests for Zod validation schemas and finance rules
- CI pipeline runs tests against a real PostgreSQL service container
- No frontend tests — CI only lints and builds the client. Component/integration tests for React would round this out

## Security — A-

- Helmet CSP, CORS from env var, rate limiting (global + auth-specific), compression
- Role-based permissions via `authorizePermission` middleware — clean and centralized
- Better Auth for session management with email verification
- Input validation with Zod on all endpoints
- `sanitizeError` hides internal details in production

**Concern:** Raw SQL with string interpolation in `accountBalancesSql` — should use parameterized queries as a defense-in-depth practice.

## DevOps — A

- Multi-stage Docker build (3 stages, Alpine, 71MB final image)
- Docker Compose with PostgreSQL healthcheck
- GitHub Actions CI with lint, typecheck, test, build stages
- PWA support with service worker + manifest
- Configurable via environment variables

## TypeScript Usage — B+

- Well-typed interfaces for domain models (`types.ts`), store state, API responses
- `AuthRequest` extends `Request` properly

**Demerits:**
- `any` leakage in controllers: `error: any`, `tx: any[]`, `where: any`
- Store is monolithic — 4 concerns (auth, dark mode, UI, school data) in one 323-line file
- `_swipeBackFn` as a mutable module-level variable

## Database Schema — A

- 17 models with proper indexes, foreign keys, unique constraints, composite keys
- Migration history tracked with Prisma Migrate
- Snapshot-based naming conventions (`@@map`, `@map`) for explicit column control
- Soft deletes via `deletedAt`, period close and reconciliation tables for fiscal integrity

## Feature Completeness — A

- Full student/teacher/staff lifecycle with photo capture, PDF cards, CSV import
- Results engine with mark entry, GPA calc, tabulation sheets, report cards
- Finance module: double-entry accounting, fee schedules, waivers, assignments, period close, bank reconciliation, AGM reports, defaulter tracking
- Audit logs, user management with 4 roles, dark mode, responsive design

## Overall Assessment

This is a well-engineered, production-quality application. The code is clean, the architecture is sound, and the feature set is comprehensive. The developer has made good tradeoffs throughout. With frontend tests and tighter TypeScript discipline, this would be an easy A.

---

## 🐛 Bug Report

### 🔴 Crash / Data Corruption

**1. `ExcelImportTab.tsx:372-373` — Class/Roll input bindings swapped**
The "Roll" `<input>` binds `value={editData.className}` and the "Class" `<input>` binds `value={editData.roll}`. Editing these fields writes values to the wrong state variables, corrupting the data on save.
*Fix:* Swap the `value` and `onChange` bindings between the two inputs.

**2. `StudentSection.tsx:124-130` (also `TeacherSection.tsx:84-90`, `StaffSection.tsx:81-87`) — Undo-restore broken by stale closure**
The toast undo callback closes over `deleteId`, but `setDeleteId(null)` runs on the next line (132). When the user clicks "Undo", the API call resolves to `/students/null/restore`, silently failing.
*Fix:* Capture the ID in a local variable before `setDeleteId(null)`:
```typescript
const idToRestore = deleteId;
toast('Deleted', '', { label: 'Undo', onClick: async () => {
  await fetch(`${API_URL}/students/${idToRestore}/restore`, ...);
}});
```

**3. `Register.tsx:62` — API error renders as `[object Object]`**
```typescript
const msg = err.response?.data?.error || err.response?.data?.error?.message || 'Failed.';
```
If `error` is an object `{ message: "Email taken" }`, the first operand is truthy and `msg` becomes `"[object Object]"`. Same pattern in `UserManagement.tsx:30`.
*Fix:* Reorder to check `.message` first:
```
err.response?.data?.error?.message || err.response?.data?.error || 'Failed.'
```

**4. `setup.controller.ts:34` — Token length timing side-channel**
```
const valid = tokenBuf.length === setupBuf.length && timingSafeEqual(tokenBuf, setupBuf);
```
If lengths differ, `timingSafeEqual` is never called, leaking the correct token length.
*Fix:* Zero-pad both buffers to the max length, always call `timingSafeEqual`.

**5. `FeeScheduleTab.tsx:21` — Missing `withCredentials: true` on GET request**
The GET to `/api/finance/fee-schedules` omits credentials while POST/PUT/DELETE include them. Silently returns empty/unauthorized data.
*Fix:* `axios.get('/api/finance/fee-schedules', { withCredentials: true })`

### 🟠 Incorrect Behavior

**6. `studentFeeAssignment.controller.ts:49-58` — Sending `active: true` toggles active assignment OFF**
When the client sends `{ active: true }` and an active assignment exists with no `startsAt`/`endsAt`/`note`, the early-return at line 52 evaluates `newActive === existing.active` as `true` and treats it as a toggle-off, **deactivating** the assignment.
*Fix:* Only toggle when `active` is explicitly `undefined`; otherwise use the provided value as the target state.

**7. `FinanceSection.tsx:318-326` — `totalIncome` excludes AL_RAWA_BANK deposits**
`totalIncome` only counts `destinationAccount === 'CASH_IN_HAND'` but the deposit dropdown allows selecting `AL_RAWA_BANK`. Income deposited directly to `AL_RAWA_BANK` is excluded from `totalIncome`, under-reporting the "Target Deposit" card. GLOBAL_FORUM_BANK is intentionally excluded (not a school operating account).
*Fix:* `totalIncome` should count `CASH_IN_HAND` + `AL_RAWA_BANK` income.

**8. `FeeScheduleTab.tsx:30` — Hardcoded academic year `'2025-2026'`**
This string will not advance past mid-2026, causing all new fee schedule creation to fail.
*Fix:* Derive the current academic year from the API response or current date.

**9. `reportPdf.ts:48,62`, `financeReportPdf.ts:21` — Hardcoded `'JPEG'` format silently fails for PNG images**
All `doc.addImage(raw, 'JPEG', ...)` calls pass `'JPEG'` as format. If the logo or photo is PNG, jsPDF silently fails and the image is blank.
*Fix:* Omit the format parameter or use `'UNKNOWN'` for auto-detection.

**10. `FinanceReports.tsx:149-152` — Filter depends on potentially absent `affectsIncomeLedger`/`affectsExpenseLedger` fields**
If the API response doesn't include these booleans, the filter collapses to `undefined && ...` which is falsy, excluding all transactions from reports.
*Fix:* Fall back to filtering by `transactionType` when these fields are absent.

**11. `FinanceSection.tsx:563` — Fee schedule filter crashes on empty `students` array**
When `selectedStudent` is set but `students` hasn't loaded, `students.find()` returns `undefined`, filtering out all schedules for that student.
*Fix:* Guard with `students.length > 0 && ...`

**12. `studentFeeAssignment.controller.ts:97-98` — Empty date string creates `Invalid Date`**
```
...(startsAt ? { startsAt: new Date(startsAt) } : {}),
```
If `startsAt` is a whitespace-only string, it's truthy but `new Date("")` is `Invalid Date`, crashing the entire transaction.
*Fix:* `startsAt?.trim() ? new Date(startsAt) : undefined`

### 🟡 Code Smells

| # | Location | Issue |
|---|----------|-------|
| 13 | `finance.controller.ts:12-23` | Raw SQL with string interpolation (`${start.toISOString()}`) — should use parameterized queries |
| 14 | `server/src/store.ts` | 4 concerns (auth, dark mode, UI, school data) in one 323-line file; 18 `catch { /* silent */ }` blocks |
| 15 | `finance.controller.ts` | 780-line controller mixing period close, reconciliation, defaulter, AGM — needs splitting |
| 16 | `result.controller.ts:27-33` | `createSubject` validates manually instead of using Zod |
| 17 | `store.ts` | No retry logic or loading state exposed for individual API calls |
| 18 | `server/prisma/schema.prisma` | Photos stored as `Bytes?` (BYTEA) — scales poorly vs object storage with URLs |
| 19 | CI pipeline | No frontend tests — only lints and builds. No E2E tests against real DB in CI |

---

*Review generated by DeepSeek AI on June 1, 2026*
