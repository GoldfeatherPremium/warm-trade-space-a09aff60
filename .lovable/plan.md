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
- ✅ Rate limiting on `createOrder`, `openDispute`, `leaveReview`, `toggleFollowSeller`
- TODO: rate limit `sendMessage` extras, `startProductConversation`, coupon save, boost
- TODO: IDOR sweep on every server fn that takes an id (verify ownership / staff check)
- TODO: file-upload MIME/size validation on `/api/public/img.$id`
- TODO: audit log coverage on admin mutations
- TODO: webhook signature stub on `api/public/cron/*`

## Phase C — Performance + bundle
- DB index audit on hot queries (`products.status,created_at`, `orders.buyer_id,status`, `seller_follows.seller_id`)
- N+1 sweep on browse, storefront, seller orders
- Code-split admin and seller route bundles
- LCP image preload on `/`, lazy-load below-fold images
- Remove unused deps; tree-shake icon imports

## Phase D — SEO + structured data
- ✅ Organization + WebSite JSON-LD (root)
- ✅ Product + Breadcrumb JSON-LD (PDP)
- ✅ Sitemap with products, sellers, categories
- ✅ llms.txt
- TODO: FAQ JSON-LD on homepage
- TODO: Seller / Store JSON-LD on `/s/$username`
- TODO: per-route head() on browse, sellers, account pages
- TODO: internal linking pass (category → related categories, seller → similar sellers)

## Phase E — Trust + conversion polish
- Trust chips on every product card surface (browse, search, storefront, recommendations)
- Social proof on PDP: recent buyers, view count, "X bought today"
- Urgency cues: low-stock warning, featured countdown, sale ends-in
- Checkout: guest-friendly summary, savings breakdown, one-tap coupon
- Empty states: cart, favorites, orders all show high-intent upsell

## Phase F — Final pass
- Accessibility: aria labels, focus rings, color contrast, keyboard nav
- Dead-code + unused-import sweep
- Smoke test on every primary user flow (signup → buy → review)
- README + operator runbook

## Excluded
- Subscription Sharing
- Real payment-processor onboarding (simulated gateway stays as-is)
