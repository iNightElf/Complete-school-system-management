# MiMo Code Review

**Date:** June 1, 2026
**Reviewer:** MiMo (opencode/mimo-v2.5-free)
**Grade: B-** (Functional but with critical security gaps)

---

## CRITICAL Issues (Fix Immediately)

| # | Issue | File |
|---|-------|------|
| 1 | **Production secrets committed to git** — DB password, JWT secret, SMTP password, setup token all in `server/.env` | `server/.env` |
| 2 | **SQL injection in balance query** — Raw string interpolation `${from}`, `${to}` in raw SQL | `server/src/controllers/finance.controller.ts:22` |
| 3 | **`server/.env` not in `.gitignore`** — Secrets will keep being committed | `server/.gitignore` |

---

## MAJOR Issues

| # | Issue | File |
|---|-------|------|
| 4 | **Inter-bank transfers classified as INCOME/EXPENSE** instead of INTERNAL_TRANSFER — pollutes P&L reports | `server/src/lib/finance-rules.ts` |
| 5 | **No rate limiting on auth endpoints** — brute-force vulnerable | `server/src/app.ts` |
| 6 | **No CSRF protection** on state-changing endpoints | `server/src/app.ts` |
| 7 | **Legacy Firebase app still accessible** — bypasses new auth entirely | `index.html` + `js/*` |
| 8 | **Balance calculation loads ALL transactions into memory** — O(n) JS loop, will OOM at scale | `server/src/controllers/finance.controller.ts:70-98` |
| 9 | **DeleteConfirmModal Enter key triggers deletion** without checking target | `client/src/components/DeleteConfirmModal.tsx:16-20` |
| 10 | **Extensive `any` types** defeat TypeScript safety | Multiple controllers + `store.ts` |

---

## MINOR Issues

- Base64 school logo embedded in source code (inflates bundle)
- Hardcoded `2026` copyright year in footer
- Migration script has hardcoded Windows path
- No password strength validation server-side
- `Toast` singleton pattern is fragile
- Silent `catch {}` blocks in store hide API errors from users

---

## Strengths

- Well-structured React 19 + TypeScript + Tailwind v4 SPA
- Solid backend: Express 5 + Prisma + Zod + Better Auth + RBAC (4 roles, 19 permissions)
- Good test coverage (602-line integration suite + unit tests)
- Soft delete with restore, audit logging, immutable finance history
- Mobile-first with dark mode, swipe nav, camera integration
- Modern tooling (Vite, Zustand, Vitest, Playwright)

---

## Top Improvements (Priority Order)

1. **Rotate all secrets immediately** — they're compromised in git history
2. **Add `server/.env` to `.gitignore`** and scrub from git history
3. **Add rate limiting** (`express-rate-limit`) to auth endpoints
4. **Replace SQL string interpolation** with parameterized queries
5. **Remove or protect the legacy Firebase app** (auth bypass vector)
6. **Fix inter-bank transfer classification** to `INTERNAL_TRANSFER`
7. **Optimize balance calculation** — use SQL aggregation, not JS iteration
8. **Add user-facing error messages** (silent catch blocks hide failures)
9. **Replace `any` types** with proper interfaces
10. **Add password policy** (min 8 chars, complexity requirements)

---

## Summary

The architecture and code quality are solid for a B+. But the **committed production credentials** and **SQL injection vector** are deployment-blocking. Fix security first, then address the financial logic bugs.
