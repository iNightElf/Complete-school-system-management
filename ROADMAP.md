# ROADMAP — All Items Complete

All items identified during the full codebase audit have been fixed.

---

## ✅ Completed (May 31, 2026)

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

### .env.example
- Created with all required env vars and documentation

### CORS from Env Var
- Origins read from `CORS_ORIGINS` env var, fallback to localhost

### CSV Export
- Download buttons on all 6 report tabs with UTF-8 BOM for Excel

### Photo Caching
- `Cache-Control: public, max-age=86400` + ETag with `304 Not Modified`

### Prisma Upsert
- `saveStudentResult` uses `result.upsert()` instead of find+update/create

### Compression
- Gzip middleware on all API responses

### Google Fonts
- Moved from `@import` to `<link>` with preconnect

### N+1 Query Fix
- `getAllClasses` uses single `groupBy` instead of per-class COUNT

### Loading Skeletons
- Book list skeleton, defaulter report skeleton rows

### Dashboard Redesign
- Gradient welcome banner, time-based greeting, stat cards, module tiles with hover arrows

### Route Code Splitting
- `React.lazy` + `Suspense` on all 5 routes
- Vite manualChunks for vendor libs (react, jspdf, xlsx, framer-motion)

### PWA
- `manifest.json`, service worker with install + cache, SW registration in `main.tsx`
- SVG favicon (no PNG generator needed)

### Dark Mode
- Tailwind `@custom-variant dark`, CSS overrides, `useDarkMode` store with localStorage

### Mobile Card Layout
- `.mobile-card-table` CSS collapses tables to stacked cards on screens < 640px

### Icon Polish
- Emoji → lucide-react icons across ~20 files
- Login/Register pages redesigned with gradient backgrounds, school logo, blur circles
- Student/Teacher/Staff cards changed to vertical centered layout

--- 

## ✅ Bug Audit (Same Session)

### Client-Side Fixes
- **fetch() HTTP error checking** — Student/Teacher/Staff sections now check `res.ok` before showing success toast
- **EnterByStudent stale closure** — Auto-save no longer captures stale marks/attendance/comment in debounce timeout (uses refs)
- **EnterByStudent unhandled rejection** — Save button wrapped in try/catch
- **Login/Register `<a>` → `<Link>`** — Full page reloads replaced with client-side navigation
- **ClassManagerModal `alert()` → `toast()`** — Inconsistent blocking dialogs removed
- **CameraModal `err.message`** — Fallback for `undefined` error messages
- **OnlineReportCard `getState()`** — Now uses Zustand hook subscription for reactivity
- **Dead code** — Removed no-op ternary `photo.startsWith('data:') ? photo : photo` in 3 files
- **Service worker warning** — Added `message` handler to prevent Chrome "listener returned true" error

### Server-Side Fixes
- **validate.ts Zod v4 crash** — Fixed `errors` → `issues` and `z.record(z.number())` → `z.record(z.string(), z.number())`
- **parsePhoto crash** — Malformed base64 data URIs no longer throw (try/catch + null return)
- **Error message leakage** — All 4 controllers (student, ops, result, class) now use `sanitizeError()` instead of leaking `error.message`
