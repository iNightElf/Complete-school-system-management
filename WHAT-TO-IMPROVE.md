I'll do a thorough code review of this project. Let me analyze the codebase systematically.Here's my comprehensive review:

---

## 🔴 Critical Issues

**1. Finance: Balance Calculation is Fundamentally Wrong**
`getBalances` fetches ALL transactions from DB into memory and loops through them on every request. With 10,000+ transactions this will be slow and memory-hungry. Use Prisma's `aggregate` or a running balance ledger table instead.

**2. Finance: Income Always Forces to CASH_IN_HAND**
The code hardcodes `destination = 'CASH_IN_HAND'` for all income. This means you can't record a bank transfer, cheque deposit, or direct bank payment. In a real school, tuition is sometimes paid directly to the bank.

**3. No Database Transactions for Critical Multi-Step Operations**
`saveStudentResult` does a findFirst + update/create without a transaction — a concurrent request between those two operations could create duplicate result rows despite the unique constraint. This should use `prisma.result.upsert()`.

**4. Defaulter Report Has a Logic Bug**
The defaulter report marks every student as a defaulter for every fee, even fees they shouldn't be paying (e.g., Hifz fee for a non-Hifz student). The `defaultAmt` falls back to 0 but still shows a row — causing ghost rows in the report.

**5. The `calcAttendPct` Helper Returns `—` for Missing Data But `saveStudentResult` Saves `{days:0, present:0}`**
When attendance is blank it saves zeros, which later shows "0%" instead of "—". Zero and "not entered" are different things.

---

## 🟠 Serious Problems

**6. No Input Validation / Zod on Server**
Zod is installed but completely unused (`// zod is installed but unused`). Every controller directly destructures `req.body` with no validation. A user can send `amount: -999999` or `term: "DROP TABLE"` with no guard.

**7. `saveStudentResult` in Store Signature is Wrong**
```ts
saveStudentResult: async (studentId, term, marks, attendance?, comment?) => ...
```
But the store definition doesn't include `comment` in the type signature — it's silently dropped. The API call includes `comment` but the store type doesn't declare it.

**8. Photos Stored as BYTEA in PostgreSQL**
Storing binary blobs in a relational DB is an antipattern. With 500+ students this grows the DB significantly. Should use an object store (S3, Cloudinary, or even local disk) and store URLs.

**9. Finance Reports Filter Transactions in JavaScript, Not SQL**
```ts
const filtered = transactions.filter((t) => { ... })
```
This loads ALL transactions into the frontend store, then filters in JS. With thousands of transactions this means a massive API response on every page load.

**10. Global Forum Bank Balance Not Shown in UI**
The code calculates `globalForumBank` balance but the Finance UI only shows AL_RAWA_BANK and CASH_IN_HAND cards. The Global Forum balance is invisible to users.

**11. Grading Scale — GPA 3.00 for 'D' Grade (40-44%)**
Using 0-100% mapped to a 0-5 GPA is non-standard. The gap between D (3.00) and F (0.00) is enormous. A student going from 39% to 40% jumps 3 GPA points. This distorts class rankings significantly.

---

## 🟡 Notable Code Quality Issues

**12. `FinanceReports.tsx` is 500+ Lines in One Component**
The entire finance reports module is a single component with 6 tabs, 4 PDF generators, and all data logic crammed in. It's unmaintainable.

**13. PDF Generation Logic Mixed into React Components**
`DefaulterTab.tsx`, `FinanceReports.tsx`, `TabulationTab.tsx` all contain raw jsPDF calls inline. PDF generation should be extracted to `lib/` files like `reportPdf.ts` already demonstrates.

**14. `useEffect` Missing Dependencies Everywhere**
```tsx
useEffect(() => { fetchClasses(); fetchStudents(); }, []); // missing deps
```
This pattern is repeated 20+ times. It works but suppresses ESLint warnings and can cause stale closure bugs.

**15. `toast()` Called with Empty String `''` as Type**
```ts
toast('Saving…', '');
```
The `toast` function type is `'success' | 'error' | ''` — the empty string is being used as a neutral state but it's not actually typed. The type should be `'info' | 'success' | 'error'`.

**16. Transaction Reference IDs Not Enforced as Unique**
The `referenceId` field exists but has no unique constraint in the schema. Double-importing the same Excel file will create duplicate transactions silently.

**17. `ExcelImportTab.tsx` — `useSchoolStore.getState()` Inside Component**
```ts
const storeStudents = useSchoolStore.getState().students;
```
Calling `getState()` inside a React component bypasses reactivity. It might read stale data. Use the hook instead.

**18. `ClassManagerModal` Uses `confirm()` for Deletion**
Browser `confirm()` dialogs are blocked in many contexts (iframes, some mobile browsers) and look terrible. The app already has a pattern for inline confirmation (UserManagement.tsx) — use that instead.

---

## ✅ What's Done Well

**Good architecture decisions:**
- Role-based permissions system (`lib/permissions.ts`) is clean and centralized
- Shared `PrismaClient` singleton prevents connection pool exhaustion
- `mergeMarks` approach in `saveStudentResult` prevents data loss when saving one subject at a time
- `calcAttendPct` utility prevents division-by-zero
- Error sanitization (`lib/errors.ts`) prevents Prisma schema leaks to clients
- Rate limiting is implemented
- Transaction cancellation creates a reversal entry rather than deleting — this is correct double-entry behavior
- `finance-rules.ts` cleanly separates classification logic
- Photos loaded on-demand (`hasPhoto: true/false`) instead of embedding base64 in list responses — good call
- `AbortController` in `DefaulterTab` for cleanup — correct
- `ErrorBoundary` wrapping the app

---

## 🔧 Priority Improvements

1. **Immediate:** Add Zod validation to all controllers ✅
2. **Immediate:** Replace `saveStudentResult` find+create with `prisma.result.upsert()` ✅
3. **High:** Move balance calculation to DB aggregation ✅
4. **High:** Add `@@unique([referenceId])` or at minimum a pre-import duplicate check
5. **Medium:** Extract PDF logic from components into lib files
6. **Medium:** Add `feeMonth` uniqueness check — currently a student can have multiple payments for the same month recorded
7. **Medium:** Fix the `comment` parameter in the store type signature
8. **Low:** Replace `confirm()` dialogs with inline confirmation UI

---

## ✅ New Fixes (May 31, 2026)

- **Opening Balances (Approach 3):** Added `OpeningBalance` + `OpeningBalanceHistory` models. User-settable opening balances per fiscal year per account, default 0. AGM report uses stored balances with per-account net change tracking. Full change history with one-click revert (backtrack).
- **Server-side Pagination:** All `getAll*` endpoints (`Students`, `Teachers`, `Staff`, `Books`) accept `skip`/`take` params and return `{ data, total }`. Client store handles paginated responses.
- **Configurable Fiscal Year:** Hardcoded Sep–Aug replaced with `FISCAL_YEAR_START_MONTH` in `client/src/lib/config.ts`. All labels and filter logic use the config value.
- **CORS from Env Var:** Origins read from `CORS_ORIGINS` env var with fallback to localhost.
- **CSV Export:** Download buttons added to all report tabs with UTF-8 BOM for Excel.
- **Photo Caching:** `Cache-Control: public, max-age=86400` + ETag with `304 Not Modified` on all photo endpoints.
- **Prisma Upsert:** `saveStudentResult` uses `result.upsert()` instead of `findFirst`+`update/create`.

## ✅ Bug Audit (Same Session)

### Client
- **fetch() HTTP error checking** — Student/Teacher/Staff sections now check `res.ok` before showing success toast
- **EnterByStudent stale closure** — Auto-save uses refs to avoid capturing stale state in debounce timeout
- **EnterByStudent unhandled rejection** — Save button wrapped in try/catch
- **Login/Register `<a>` → `<Link>`** — Full page reloads replaced with client-side navigation
- **ClassManagerModal `alert()` → `toast()`** — Removed blocking dialogs
- **CameraModal `err.message`** — Fallback for undefined error messages
- **OnlineReportCard `getState()`** — Now subscribes via hook for reactivity
- **Dead code** — Removed no-op `photo.startsWith('data:') ? photo : photo` ternaries (3 files)
- **SW warning** — Added message handler to prevent console warning

### Server
- **validate.ts Zod v4 crash** — `errors` → `issues`, `z.record(z.number())` → `z.record(z.string(), z.number())`
- **parsePhoto crash** — Malformed base64 no longer throws (try/catch)
- **Error message leakage** — All 4 controllers now use `sanitizeError()` instead of leaking `error.message`
