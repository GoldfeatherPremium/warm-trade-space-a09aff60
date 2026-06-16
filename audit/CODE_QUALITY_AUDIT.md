# CODE_QUALITY_AUDIT.md — X-VAULT Marketplace

## Architecture & structure
- Clear separation: `app/**` (routes + colocated `*-client.tsx`), `src/server/actions/**` (mutations, `"use server"`), `src/server/queries/**` (reads), `src/lib/server/**` (domain services: money, fraud, trust, search, coupons, loyalty, growth, lifecycle, db). This is a sound, legible layering.
- Dual-engine DB abstraction (`db.server.ts`) with one portable SQL dialect is elegant and well-documented.
- Server actions consistently `try/catch` and return `{ ok, error }` discriminated unions — predictable client contract.

**Strengths:** comments explain *why* (migration race handling, pooler notes, timing-safe login) — above-average intent documentation.

## Issues

### Maintainability / size
- `src/server/actions/admin.ts` ≈ **1907 lines** and `seller.ts` ≈ **1228 lines** — god-modules mixing many concerns. Split by domain (finance, moderation, catalog, verifications…).
- `db.server.ts` ≈ **1356 lines** combines engine, schema, migrations, seeding — consider splitting schema/migrations out.

### Correctness defects (also in SECURITY/FRAUD)
- **Wrong hashing in `account.ts`** (sha256 vs scrypt) — C1.
- **Non-existent columns**: `users.updated_at` (`account.ts:30,43,65`) and `wallet_ledger.ref_id/kind` (`growth.server.ts:38`) — H1/C2. These indicate **missing integration tests** against the real schema; both would be caught by a single smoke test of profile-update and referral-payout.

### Error handling
- `migrate()` additive `alter table ... .catch(()=>{})` swallows **all** errors, not just duplicates (`db.server.ts:850-851`). Narrow to `isDuplicateObjectError`.
- `maybePayoutReferralForOrder` has no try/catch around a query that currently throws (C2) — payout path can break the caller.

### Duplication
- `StatCard` ×2; refund logic ×2; security headers set in both `next.config.ts` and `middleware.ts` (with a subtle divergence in `Permissions-Policy`). See DEAD_CODE.

### Naming / consistency
- Generally good and consistent (`tx*` for transactional money ops, `require*` for guards, `*Action` for server actions). Minor: `kind` vs `type` vocabulary drift (the C2 bug literally stems from this drift between ledger schema `type` and code expecting `kind`).

### Config hygiene
- `package.json` name is `tanstack_start_ts` (stale identity) and carries 10 unused Vite/TanStack deps (DEAD_CODE).
- Two TS configs (`tsconfig.json`, `tsconfig.next.json`) — intentional (Next vs shared src), documented.

## Testing
- `scripts/smoke-test.ts` exists (good signal) but the two schema-mismatch bugs (C2/H1) survived, implying coverage gaps on profile + referral + withdrawal-concurrency. **Recommend:** add integration tests that run the real migrations then exercise: register→login→change-password, referral signup→order→release (payout once), concurrent withdrawals (balance never negative).

## Type safety
- TypeScript throughout; DB rows typed at call sites via generics on `q/q1`. Risk: these generic types are **asserted, not validated** — a query selecting a non-existent column (C2) compiles fine. Consider a thin schema/zod parse on critical money reads, or generated types from the DB.

## Overall
Architecturally mature and readable; the quality problems are concentrated in (a) a few schema/code mismatches that tests would catch, (b) oversized action modules, and (c) over-broad error swallowing. None are structural rewrites.
