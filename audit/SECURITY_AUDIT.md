# SECURITY_AUDIT.md — X-VAULT Marketplace

**Scope:** Authentication, authorization, sessions, cookies, role access (buyer/seller/support/finance/admin), API routes, server actions, injection, XSS, CSRF, SSRF, redirects, rate limiting, password & secret management, encryption, uploads, and the money subsystems (wallet/escrow/coupon/referral/withdrawal/notifications).

**Method:** Static source review of `src/server/**`, `src/lib/server/**`, `app/api/**`, `middleware.ts`, `next.config.ts`. Every finding cites `file:line` with an excerpt. Items that cannot be confirmed by static reading are marked **UNVERIFIED**.

**Engine note:** dynamic exploitation was not run (no live DB/deploy in this environment); all findings are from code evidence.

---

## CRITICAL

### C1 — Password change uses unsalted SHA-256 and is also functionally broken
**File:** `src/server/actions/account.ts:19-34`
```ts
const { createHash } = await import("node:crypto");
const hash = (p: string) => createHash("sha256").update(p).digest("hex");
...
if (!row || row.password_hash !== hash(input.currentPassword))
  return { ok: false, error: "Current password is incorrect." };
await run(`update users set password_hash = ?, updated_at = ? where id = ?`, [hash(input.newPassword), now(), user.id]);
```
Registration/login use **scrypt+salt** (`src/lib/server/core.server.ts:27-38`). This handler instead uses raw `sha256(password)`:
- **Security:** unsalted SHA-256 is rainbow-table / GPU-brute trivial. A DB leak exposes any password changed through this path.
- **Correctness:** because stored hashes are scrypt (`salt:hash`), `row.password_hash !== sha256(current)` is *always true* → "Current password is incorrect." for every real user, so password change is effectively unusable; and if it ever did write, the new `sha256` hash can never be verified by `verifyPassword()` (scrypt) → account lockout.
**Fix:** use `verifyPassword()` / `hashPassword()` from `core.server.ts`.

### C2 — Affiliate payout idempotency check references non-existent columns
**File:** `src/lib/server/growth.server.ts:37-41`
```ts
const already = await q1(
  `select 1 from wallet_ledger where user_id = ? and ref_id = ? and kind = 'adjustment'`,
  [ref.owner_user_id, orderId]);
if (already) return;
```
`wallet_ledger` columns are `user_id, order_id, type, amount_cents, balance_after_cents, note, created_at` (`src/lib/server/db.server.ts:536-545`). There is **no `ref_id` and no `kind`** column. On Postgres this query throws `42703 undefined_column`. `maybePayoutReferralForOrder` has no try/catch around it, so depending on the caller either (a) the release flow errors, or (b) if the error is swallowed upstream, the dedup never matches and **the affiliate is paid again on every release of the same order** (double/triple payout = direct money loss).
**Fix:** `where user_id = ? and order_id = ? and type = 'adjustment'`.

### C3 — Withdrawal balance check is not race-safe (double-spend window)
**File:** `src/lib/server/money.server.ts:141-162` (`txWithdrawalHold`), same pattern in `txCreditSpend` (`:279-289`)
```ts
const w = await getWallet(userId);
if (w.available_cents < amountCents + feeCents) fail("Insufficient available balance.");
await run(`update wallets set available_cents = available_cents - ? where user_id = ?`, [amountCents+feeCents, userId]);
```
The check-then-update is not guarded by a conditional `WHERE available_cents >= ?` and there is no `SELECT ... FOR UPDATE`. On Postgres under default **READ COMMITTED** with the pooled engine, two concurrent withdrawals (or a withdraw + a checkout debit) can both read the same balance, both pass the check, and both subtract → **balance goes negative / funds withdrawn twice**. SQLite is protected only because `tx()` serializes via a process mutex (`db.server.ts:82-100`) — that protection disappears in production Postgres.
**Fix:** make the decrement conditional and atomic: `update wallets set available_cents = available_cents - ? where user_id = ? and available_cents >= ?` and verify affected-row count, or `SELECT ... FOR UPDATE` the wallet row at the top of the tx.

---

## HIGH

### H1 — `account.ts` writes to `users.updated_at`, a column that does not exist
**File:** `src/server/actions/account.ts:30, 43, 65`. The `users` table (`db.server.ts:383-399`) has no `updated_at`, and no `alter table users add column updated_at` exists in `migrate()` (`db.server.ts:744-848`). Every profile/preferences update therefore throws at runtime → username change, password change, and locale/currency/country updates are all broken. (Availability/integrity impact; pairs with C1.)
**Fix:** remove `updated_at` from these statements or add the column to the schema.

### H2 — No HSTS header
**Files:** `next.config.ts:3-29` (security headers list) and `middleware.ts:6-9`. Neither sets `Strict-Transport-Security`. Users are exposed to SSL-strip / protocol-downgrade MITM on first or subsequent visits.
**Fix:** add `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` to `securityHeaders`.

### H3 — Login/registration rate limiting is per-email and per-process only
**Files:** `src/server/actions/auth.ts:28,76`, `src/lib/server/rate-limit.server.ts:6`.
- Keyed by `login:${email}` / `register:${email}` — **no IP-based limit**, so credential-stuffing across thousands of distinct emails from one IP/botnet is unthrottled.
- The bucket store is an in-process `Map` (`rate-limit.server.ts:6`). On serverless/multi-isolate (Vercel) each instance has its own map; effective limit = perLimit × instanceCount, and resets on every cold start. The same weakness applies to the withdrawal/dispute/checkout limiters.
**Fix:** add an IP (and IP+email) dimension; back the limiter with Redis/Upstash or an edge WAF for shared state.

### H4 — Stock/credential encryption key derived with plain SHA-256 (no KDF)
**File:** `src/lib/server/core.server.ts:41-52`
```ts
return createHash("sha256").update(rawKey).digest();
```
The AES-256-GCM key for all sold stock + subscription credentials is `sha256(STOCK_ENCRYPTION_KEY)`. SHA-256 is a fast hash; if `STOCK_ENCRYPTION_KEY` is anything less than high-entropy, the key is brute-forceable offline, and there is no minimum-length/entropy guard. AES-GCM usage itself is correct (random 12-byte IV, auth tag).
**Fix:** derive via `scryptSync(rawKey, fixedAppSalt, 32)` and reject keys shorter than ~32 chars at boot.

### H5 — Withdrawal approval lacks maker-checker (4-eyes) separation
**Files:** `src/server/actions/admin.ts` withdrawal flow (approve `:619-622`, mark-sent `:633-636`, reject+reversal `:646-650`); gated by `requireStaff` whose default allows `support|finance|admin` (`src/server/auth.ts:104-111`). A single `finance` actor can move a withdrawal `pending → approved → sent` with no second approver. For a crypto payout system this is the highest-leverage internal-fraud path. **Partial UNVERIFIED:** exact per-action role list inside each handler not line-confirmed here; the control *gap* (no distinct approver vs. sender role enforced) is confirmed by the schema/flow.
**Fix:** require two distinct staff IDs across `approved` and `sent`, plus per-actor daily payout ceilings.

---

## MEDIUM

### M1 — CSP allows `script-src 'unsafe-inline'`
**File:** `next.config.ts:17`. Inline scripts are permitted, weakening XSS containment. (Next 15 SSR currently needs it without a nonce pipeline.) **Fix:** move to nonce/hash-based CSP. Note: app JSON-LD is injected via `dangerouslySetInnerHTML` with `JSON.stringify` of **static** objects (`app/page.tsx:118-126`, `app/p/[slug]/page.tsx:131-135`, `app/s/[username]/page.tsx:72`) — no user input flows in, so these are not an XSS sink today.

### M2 — `updatePreferencesAction` accepts arbitrary locale/currency/country
**File:** `src/server/actions/account.ts:56-72`. No Zod/enum validation — any string is written to `users.locale/preferred_currency/country`. These values are later rendered and used for currency math. Low XSS risk via the existing escaping, but data-integrity/abuse risk is real.
**Fix:** validate against ISO-4217 currency, supported-locale enum, and ISO-3166 alpha-2 country.

### M3 — Coupons have no per-user usage limit
**Files:** `src/lib/server/coupons.server.ts:17-35`, redemption increment `src/server/actions/orders.ts:189-193`. Global `max_uses` is enforced atomically (good), but nothing stops one buyer from redeeming the same coupon on unlimited separate orders, or one user farming a percentage coupon across many self-created orders.
**Fix:** track `coupon_redemptions(coupon_id, user_id)` and cap per user.

### M4 — Referral abuse: duplicate-account self-referral not prevented
**Files:** `src/server/actions/auth.ts:41-57`, `src/lib/server/growth.server.ts`. Direct self-referral is blocked (`ref.owner_user_id !== id`), but there is no device/IP/fingerprint correlation, so a user can register N accounts and farm signup + purchase commissions. `referral_clicks.fingerprint` is always inserted `null` (`growth.server.ts:15`), so click fraud is also unbounded.
**Fix:** capture and correlate IP/device fingerprint; defer/clawback payouts on chargeback or refund.

### M5 — `ref_code` cookie is non-HttpOnly
**File:** `app/r/[code]/route.ts` — `httpOnly: false`. JS-readable; minor exfil/manipulation surface. The redirect target itself is hardcoded to `/` (`new URL("/", request.url)`), so **no open-redirect** here (good).
**Fix:** set `httpOnly: true` unless the client genuinely needs to read it.

### M6 — SSE endpoint authenticates but polls the DB per connection
**File:** `app/api/events/route.ts:10-57`. Auth is enforced (401 if no user, good), but each connection runs a correlated unread-count query every 20s for up to 55s. This is a DoS/cost amplifier at scale (see PERFORMANCE_AUDIT and SCALABILITY_AUDIT). Not an auth bug; flagged here as availability.

---

## LOW / OBSERVED-OK (defensive notes)

- **Login user-enumeration:** mitigated — a `DUMMY_HASH` keeps `verifyPassword` timing constant for unknown emails (`auth.ts:66-84`). Good.
- **Session cookie:** `httpOnly`, `sameSite=lax`, `secure` in production, 14-day TTL, 32-byte random token (`src/server/auth.ts:35-51`). Good. Banned users rejected at `currentUser()` (`auth.ts:83`).
- **SQL injection:** all queries reviewed use `?`→`$n` parameter binding via `q/q1/run` (`db.server.ts:130-200`); search builds parameterized `like ?` fragments (`search.server.ts:30-45`). No string interpolation of user input into SQL was found. **No SQLi identified.**
- **Image route:** validates MIME allowlist + `nosniff` (`app/api/public/img/[id]/route.ts:3,18-28`). Good.
- **`DATABASE_URL` guard** at boot in production (`db.server.ts:256-265`). Good.
- **Secret note:** there is **no `SESSION_SECRET`** in this codebase (sessions are random DB tokens, not signed) — a prior report's "SESSION_SECRET missing at startup" finding does not apply. The relevant secret is `STOCK_ENCRYPTION_KEY`, validated lazily on first use (`core.server.ts:42-50`) rather than at boot. **Fix (low):** validate it at startup in production.

---

## Authorization matrix (verified gates)
- `requireUser` / `requireSeller` / `requireStaff(roles)` / `requireAdmin` defined in `src/server/auth.ts:88-117`; `isStaff` = admin|support|finance.
- Object-ownership checks observed on seller mutations (e.g. `product_images ... where id = ? and seller_id = ?`, `seller.ts:388-394,455`; coupon ownership `seller.ts:1078-1081`). **Recommendation (UNVERIFIED completeness):** systematically audit every action in `admin.ts`/`seller.ts`/`orders.ts` for a role gate + ownership check; the surface is large (admin.ts ≈1907 lines) and was not line-by-line exhausted here.

## Priority order
C1, C2, C3 → H1, H2, H3, H4, H5 → M1–M6 → LOW.
