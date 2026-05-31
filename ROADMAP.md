# ROADMAP — All Items Complete

All items identified during the full codebase audit on May 31, 2026 have been fixed.

---

## ✅ Completed (May 31, 2026)

### 1. AGM Opening Balance Calculation — COMPLETE
- Stored opening balances per fiscal year per account (`OpeningBalance` model)
- User-settable via UI (defaults to 0 for new schools)
- AGM report uses stored balances instead of flawed `closing - income + expense` formula
- Full change history with undo/revert for backtracking (`OpeningBalanceHistory` model)

### 2. Server-side Pagination — COMPLETE
- `getAllStudents`, `getAllTeachers`, `getAllStaff`, `getAllBooks` accept `skip`/`take` query params
- Response includes `{ data, total, skip, take }` structure
- Client store handles paginated responses with backward compatibility

### 3. Hardcoded Fiscal Year — COMPLETE
- Centralized config in `client/src/lib/config.ts` (`FISCAL_YEAR_START_MONTH = 8`)
- All AGM report labels use dynamic month names
- Server fiscal year also configurable

### 4. .env.example — COMPLETE
- Created `server/.env.example` with all required env vars and documentation

### 5. Online Report Card Rank Staleness — ALREADY CORRECT
- `getState()` used at render time with fresh data; no stale issue

### 6. Hardcoded CORS Origins — COMPLETE
- CORS origins read from `CORS_ORIGINS` env var (comma-separated)
- Falls back to `localhost:5173,localhost:3000`

### 7. CSV Export — COMPLETE
- CSV download buttons added alongside PDF/Print for all report tabs
- UTF-8 BOM for Excel compatibility

### 8. Photo Caching Headers — COMPLETE
- `Cache-Control: public, max-age=86400` on all photo endpoints
- ETag headers with `304 Not Modified` support
- Applied to student, teacher, and staff photos

### 9. Defaulter Fee Month — ALREADY CORRECT
- Logic prefers `feeMonth` over transaction date; correct behavior

### Additional Fixes
- **Prisma upsert**: Replaced `findFirst+update/create` with `result.upsert()` in `saveStudentResult`
- **Opening Balance UI**: Full modal with edit/save/revert/history in Finance Reports
- **Backtrack/Undo**: Change history for opening balances with one-click revert
