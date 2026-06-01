# Code Review: AL RAWA English School Management System

## Overall Grade: **B+** (Strong with notable issues)

---

### Architecture & Design: **A-**
- Clean separation of client/server, role-based permissions, audit logging, double-entry accounting, soft deletes — all well done
- `OpeningBalance` with history + revert, `periodClose`, `reconciliation` — solid financial rigor
- `upsert` in `saveStudentResult` prevents race conditions; reversal entries on cancellation are correct double-entry behavior

---

### Security: **B-** ⚠️

| Issue | Severity | File |
|-------|----------|------|
| **SQL injection vector** — `accountBalancesSql` uses string interpolation for dates | High | `finance.controller.ts:22` |
| **No Zod validation** on `setOpeningBalances`, `closePeriod`, `createReconciliation`, `createSubject`, `updateSubject` | Medium | Multiple controllers |
| **Import error leak** — raw Prisma `e.message` exposed in row-level errors | Low | `student.controller.ts:212`, `ops.controller.ts:36` |
| No CSRF protection on cookie-based auth | Medium | N/A |
| No input size limits on most fields beyond Zod | Low | Various |

---

### Correctness / Bugs: **C+**

1. **`FinanceSection.tsx:319`** — `totalIncome` only counts `destinationAccount === 'CASH_IN_HAND'`, but the deposit dropdown (line 514) allows `AL_RAWA_BANK`. Income directly to bank disappears from deposit tracking. **This makes the deposit-remaining feature unreliable.**

2. **`finance-rules.ts:24-29`** — `AL_RAWA → GLOBAL_FORUM` classified as EXPENSE and `GLOBAL_FORUM → AL_RAWA` as INCOME. These are inter-bank transfers, not P&L items. They pollute income/expense reports.

3. **`updateStudent`** fetches `include: { results: true }` on every update — unnecessary overhead that grows with student history.

4. **`handleSubmit`** never sends `totalIncomeCollected` / `directExpenseBeforeDeposit` — server-side net deposit feature is dead code.

5. **Grading scale** — gap between D (3.00) and F (0.00) is a 3-point cliff at 40%. Distorts rankings significantly.

---

### Code Quality: **B**

- Good: Zod validation on 6 schemas, centralized error handling, singleton Prisma
- Rough: `FinanceSection.tsx` (638 lines), `FinanceReports.tsx` (521 lines) — too large
- `useEffect` missing dep arrays suppressed with `// eslint-disable-next-line` in 3+ files
- Import controllers process records sequentially — slow for 500 rows, could use `createMany`
- `accountBalancesSql` should use `$queryRaw` template tag instead of `$queryRawUnsafe` with string interpolation (even though dates are internal)

---

### Performance: **B-**

- `updateStudent` includes `results` relation on every update — unnecessary DB load
- Defaulter report loads ALL students + ALL allocations + ALL fee schedules into memory and processes in JS — won't scale past a few hundred students
- AGM report loads ALL transactions for the year into memory for JS-side filtering
- Sequential row processing in imports (500 inserts = 500 round trips)

---

### Testing: **A-**

- 74/74 integration + unit tests passing, 2/2 E2E
- Zero TS errors, zero ESLint errors
- Missing: controller integration tests for finance edge cases, defaulter report tests

---

### What's Done Well

- Role-based permission system is clean and centralized
- `photo.ts` does proper magic-byte MIME detection (not just trusting `Content-Type`)
- Fiscal year configurable at runtime, not hardcoded
- CORS from env var, rate limiting, error sanitization
- `waitForDatabase` for Neon cold starts
- Full audit trail on all operations
- PWA with service worker

---

### Priority Fix List

| # | Fix | Effort |
|---|-----|--------|
| 1 | Replace raw SQL string interpolation with parameterized `$queryRaw` template tags | 15 min |
| 2 | Add Zod schemas for `setOpeningBalances`, `closePeriod`, `createReconciliation`, `createSubject` | 30 min |
| 3 | Fix `totalIncome` to count income to any internal account (not just CASH_IN_HAND) | 5 min |
| 4 | Change `AL_RAWA → GLOBAL_FORUM` / `GLOBAL_FORUM → AL_RAWA` to `INTERNAL_TRANSFER` (no ledger effect) | 10 min |
| 5 | Remove `include: { results: true }` from `updateStudent` | 1 min |
| 6 | Sanitize import error messages (don't leak `e.message`) | 5 min |
| 7 | Use `prisma.$transaction` with `createMany` for imports | 15 min |
