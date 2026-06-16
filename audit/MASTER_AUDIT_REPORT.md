# MASTER_AUDIT_REPORT.md — X-VAULT Marketplace

**Date:** 2026-06-16 · **Branch:** `claude/xvault-audit-fixes-ordlav` · **Mode:** REPORT ONLY (no code modified, nothing committed/pushed)
**Repo:** GoldfeatherPremium/warm-trade-space-a09aff60 · Next.js 15 App Router, React 19, Postgres/SQLite dual engine.

Sub-reports (in `audit/`): SECURITY, FRAUD, PERFORMANCE, DATABASE, SCALABILITY, SEARCH, MARKETPLACE, SEO, DESIGN, DEAD_CODE, CODE_QUALITY, LIGHTHOUSE.

**Verification policy:** every issue cites `file:line`. Things requiring a running app/DB/browser (Lighthouse, EXPLAIN plans, bundle sizes, pixel UI) are explicitly **UNVERIFIED** and not scored as fact.

---

## 1. CRITICAL issues (fix before any launch)
| ID | Issue | Evidence | Impact |
|---|---|---|---|
| C1 | Password change uses unsalted SHA-256 **and** is broken (never matches scrypt hashes) | `account.ts:19-34` vs `core.server.ts:27-38` | Account lockout + weak hashing |
| C2 | Affiliate payout idempotency query hits non-existent columns `ref_id`/`kind` | `growth.server.ts:37-41` vs `db.server.ts:536-545` | Throws or **double-pays affiliates** (money loss) |
| C3 | Withdrawal/credit balance check not atomic (no `FOR UPDATE`/guarded WHERE) | `money.server.ts:141-162, 279-289` | **Double-spend** under Postgres concurrency |

## 2. HIGH
| ID | Issue | Evidence |
|---|---|---|
| H1 | Writes to non-existent `users.updated_at` → profile/password/prefs updates throw | `account.ts:30,43,65` |
| H2 | No HSTS header | `next.config.ts:3-29`, `middleware.ts` |
| H3 | Rate limiting per-email + per-process only (cred-stuffing/serverless reset) | `auth.ts:28,76`, `rate-limit.server.ts:6` |
| H4 | Stock/credential encryption key via plain SHA-256, no KDF/entropy guard | `core.server.ts:41-52` |
| H5 | No maker-checker on withdrawals (single finance actor approves+sends) | `admin.ts:619-650`, `auth.ts:104-111` |
| H6 | Product/attachment images stored as base64 in Postgres, served by dynamic route | `db.server.ts:963-973`, `api/public/img/[id]/route.ts` |

## 3. MEDIUM
| ID | Issue | Evidence |
|---|---|---|
| M1 | CSP allows `script-src 'unsafe-inline'` | `next.config.ts:17` |
| M2 | `updatePreferencesAction` accepts arbitrary locale/currency/country | `account.ts:56-72` |
| M3 | Coupons have no per-user cap | `coupons.server.ts`, `orders.ts:189-193` |
| M4 | Referral/duplicate-account abuse; `referral_clicks.fingerprint` always null | `growth.server.ts:15`, `auth.ts:41-57` |
| M5 | SSE polls DB per connection every 20s | `api/events/route.ts:27-57` |
| M6 | Inline 7-query fraud scoring on payment hot path | `fraud.server.ts:29-127` |
| M7 | DB pool `max:5`, idle 5s — under-provisioned for scale | `db.server.ts:139` |
| M8 | Missing indexes: withdrawals(user_id), deposits(user_id), subscription_slots(buyer_id), product_images(seller_id) | DATABASE_AUDIT §2 |
| M9 | `migrate()` swallows ALL alter-table errors | `db.server.ts:850-851` |

## 4. LOW
| ID | Issue | Evidence |
|---|---|---|
| L1 | `ref_code` cookie non-HttpOnly | `r/[code]/route.ts` |
| L2 | Duplicate security headers (config + middleware), `Permissions-Policy` mismatch | `middleware.ts` vs `next.config.ts` |
| L3 | Dead files: `app/admin/_components/admin-{shell,ui}.tsx`, `scripts/http-test.mjs` | DEAD_CODE |
| L4 | 10 stale Vite/TanStack deps still in `package.json` | DEAD_CODE |
| L5 | Oversized modules (admin.ts 1907 / seller.ts 1228 / db.server.ts 1356) | CODE_QUALITY |
| L6 | `StatCard` / refund logic duplicated | CODE_QUALITY |

---

## Scores (evidence-based; UNVERIFIED dimensions noted)
| Dimension | Score | Basis |
|---|---|---|
| **Security** | **5.5 / 10** | Solid session/SQLi/headers foundation, but 3 critical money/auth defects (C1–C3) + HSTS/rate-limit/KDF gaps |
| **Performance** | **6 / 10 (UNVERIFIED)** | Good caching/indexes; base64 images + SSE polling + font/JS weight drag. No Lighthouse/bundle run |
| **Scalability** | **5.5 / 10** | Stateless tier good; image-in-DB, pool sizing, SSE, per-isolate state are ceilings |
| **SEO** | **8.5 / 10** | Metadata + JSON-LD + sitemap + robots strong; missing canonicals/per-page OG/sitemap scale |
| **UX** | **6.5 / 10 (partly UNVERIFIED)** | Premium design system; gaps in empty/loading states, cart, password reset, a11y pass |
| **Marketplace readiness** | **6 / 10** | Mature escrow/dispute/trust/fraud model; missing cart, password reset, single live payment rail |
| **Production readiness** | **4.5 / 10** | Blocked by C1–C3 + H1; once fixed, jumps materially |

> Scores reflect verified code state. Performance/UX carry UNVERIFIED components (Lighthouse, bundle, pixel review) and should be re-scored after the measurement steps in PERFORMANCE/LIGHTHOUSE.

---

## Top 100 improvements (consolidated, priority-ordered)

**Blockers (1–6):** fix C1 (scrypt for password change); fix C2 (correct ledger dedup columns); fix C3 (atomic guarded wallet debit); fix H1 (remove/define `updated_at`); add HSTS (H2); validate `STOCK_ENCRYPTION_KEY` + KDF (H4).

**Security/fraud (7–22):** IP+email rate limiting w/ shared store (H3); withdrawal maker-checker + daily caps (H5); per-user coupon cap (M3); device/IP fingerprint at signup/login/order/withdraw (M4); affiliate clawback on refund/chargeback; validate preference inputs (M2); nonce-based CSP (M1); narrow migration error catch (M9); HttpOnly ref cookie (L1); startup secret validation; 2FA for staff/admin; admin action audit completeness; session rotation on password change; brute-force lockout/backoff; CAPTCHA on auth; per-route authz matrix test.

**Data/scale (23–40):** images→object storage+CDN (H6); add the 4 missing indexes (M8); raise pool `max` + tune idle/lifetime (M7); SSE→pub/sub or web-push + denormalized unread counts (M5); defer heavy fraud/analytics aggregation (M6); read replicas at >500k; schema_migrations version table; EXPLAIN-driven query review on seeded data; sitemap index/pagination; materialized search suggestions; cap suggestion corpus; Redis shared cache/rate-limit; queue for notifications/push; background trust recompute w/ TTL; archive old orders/ledger; connection metrics; backup/restore drill for non-blob DB; partition large tables.

**Search (41–58):** field-weighted ranking; sold/recency/trust boosts; add sellers to suggest; synonyms/aliases table; facet+relevance integration; trending + recent searches UI; zero-result recovery; learning-to-rank from click logs; async query logging; typed autocomplete; dedicated search engine at scale; stemming; locale analyzers; sponsored-slot surfacing; saved searches; relevance tests; admin synonym UI; result caching. (Full list: SEARCH_AUDIT.)

**Marketplace/UX (59–80):** shopping cart + multi-item checkout; password reset flow; enable additional payment rails (with chargeback controls); manual-delivery proof/SLA; seller onboarding checklist; empty states everywhere; loading skeletons on tables/dashboards; trust signals on buy-box/checkout; recently viewed; order-status timeline; reviews surfacing + reminders; mobile sticky buy-box; filter drawer polish; first-purchase onboarding; storefront polish; dispute status clarity; notification preferences; wishlist/favorites surfacing; coupon UX; currency switcher; 404/error page polish; PWA install prompt.

**SEO (81–90):** canonicals; per-page OG images; product `aggregateRating` schema; sitemap real lastmod; sitemap scaling; category breadcrumb/landing pages; noindex thin filter URLs; theme-color meta; internal-link graph; image alt coverage.

**Accessibility (91–96):** alt text; form labels + aria-describedby; AA contrast; focus-visible + focus management; aria-live for toasts/SSE; keyboard nav for search/command.

**Code quality / hygiene (97–100):** delete dead files + stale deps (L3/L4); split god-modules (L5); de-duplicate StatCard/refund/headers (L6); add integration tests for password/referral/withdrawal-concurrency (would have caught C1/C2/C3/H1).

---

## Recommended fix sequencing (after approval)
**Phase 1 (blockers):** C1, C2, C3, H1 — small, surgical, high-risk-reduction.
**Phase 2 (security hardening):** H2, H3, H4, H5, M1, M2, M9.
**Phase 3 (scale/perf):** H6 (images), M5, M6, M7, M8.
**Phase 4 (growth):** cart, password reset, search ranking, SEO canonicals, a11y pass.
**Phase 5 (hygiene):** dead code, stale deps, module splits, tests.

**Awaiting approval before making any code changes.**
