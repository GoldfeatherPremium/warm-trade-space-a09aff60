# God Mode Audit — Execution Plan

Tracks the production-readiness audit. Each phase is verified before the next.

## Phase A — Workflow QA + bug sweep (IN PROGRESS)
- Link/route audit: every `<Link to=...>` resolves to a real route ✅
- Dead-state polish: empty / loading / error states on every page
- Form validation gaps on auth, checkout, seller new-product, withdrawal
- Mobile responsiveness pass on header, PDP, checkout, seller dashboard
- Route guards: `/seller/*` (seller-only), `/admin/*` (staff), `/account/*` (auth)

## Phase B — Security hardening (PARTIAL)
- ✅ Baseline security headers in `src/server.ts` (HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy, X-CTO, DNS prefetch)
- ✅ Rate limiting on `createOrder`, `openDispute`, `leaveReview`, `toggleFollowSeller`, `checkCoupon`, `payWithWallet`, `startProductConversation` (in-memory token bucket)
- ✅ `sendMessage` already rate-limited via DB count (20/min)
- TODO: IDOR sweep on every server fn that takes an id (verify ownership / staff check)
- TODO: file-upload MIME/size validation on `/api/public/img.$id` (validated at upload; revisit at serve)
- TODO: audit log coverage on admin mutations
- TODO: webhook signature stub on `api/public/cron/*` (✅ follow-digest uses CRON_SECRET)


## Phase C — Performance + bundle (PARTIAL)
- ✅ Hot-path indexes added: `products(category_id,status,created_at)`, `products(status,created_at)`, `audit_logs(created_at)`, `notifications(user_id,read_at)`, `reviews(product_id,rating)` (on top of existing buyer/seller/status indexes)
- ✅ Admin / seller route components already code-split via TanStack `autoCodeSplitting`
- ✅ LCP optimization: featured hero image `fetchpriority=high` + eager; first 4-6 product cards above-the-fold load eager, the rest lazy
- ✅ N+1 sweep: catalog hot paths use single SQL with JOINs (no per-row queries)
- TODO: Remove unused deps; tree-shake icon imports


## Phase D — SEO + structured data
- ✅ Organization + WebSite JSON-LD (root)
- ✅ Product + Breadcrumb JSON-LD (PDP)
- ✅ Sitemap with products, sellers, categories
- ✅ llms.txt
- ✅ FAQ JSON-LD on homepage
- ✅ Seller / Store JSON-LD on `/s/$username`
- TODO: per-route head() on browse, sellers, account pages
- TODO: internal linking pass (category → related categories, seller → similar sellers)


## Phase E — Trust + conversion polish (PARTIAL)
- ✅ Trust chips on PDP (escrow, instant/manual, warranty, insurance, refund)
- ✅ Low-stock urgency ("ONLY N LEFT" pulse when stock ≤ 5)
- ✅ Social proof on PDP (sold-count callout when ≥ 10)
- ✅ Trust + level badges on every product card surface (existing)
- ✅ Empty states on favorites / orders carry CTA into /browse
- TODO: checkout savings breakdown, one-tap coupon suggestions


## Phase F — Final pass (DONE)
- ✅ A11y sweep: shell + bottom-nav have aria-label; icon-only buttons audited; `min-h-screen` → `min-h-dvh` on shell + error/404 boundaries
- ✅ shadcn primitives carry ARIA via Radix; no hand-rolled custom widgets flagged
- ✅ Smoke test script present (`scripts/smoke-test.ts`) — full escrow state machine end-to-end
- ✅ Operator runbook → `docs/RUNBOOK.md` (secrets, daily checks, incident playbooks, cron, backups, release smoke tests)

## Excluded
- Subscription Sharing
- Real payment-processor onboarding (simulated gateway stays as-is)
