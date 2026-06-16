# MARKETPLACE_AUDIT.md — X-VAULT Marketplace

Journey-by-journey review of buyer, seller, and admin flows from the route tree (`app/**`) and server actions. Functional/UX gaps; security/fraud covered in their own reports.

## Buyer journey
| Stage | Route/evidence | State | Gaps |
|---|---|---|---|
| Homepage | `app/page.tsx` (JSON-LD, hero) | Good | — |
| Browse/search | `app/browse/**`, `browse-filters.tsx` | Good (filters present) | ranking/facets (see SEARCH) |
| Product page | `app/p/[slug]/page.tsx`, `buy-box.tsx`, `related-products.tsx` | Good (breadcrumb + product JSON-LD) | reviews surfacing, trust signals |
| Checkout/payment | `orders.ts` createOrder + deposit (USDT) | Functional, escrow-backed | **No cart — buy-now only** → lost multi-item orders; payment is single-rail USDT (others scaffolded disabled, `db.server.ts:1291-1299`) |
| Order/delivery | `app/orders/**`, `order-deliveries` | Good (auto + manual delivery, SLA) | delivery-proof requirements for manual unclear |
| Review | `orders.ts:492-530` | Good (order-gated, unique) | review reminders/incentives |
| Disputes | `app/disputes/**`, `disputes.ts` | Present (evidence + messages) | buyer-facing status clarity |
| Wallet/credits | `app/wallet/**`, `account/credits` | Good | — |

**Buyer blockers:** no shopping cart; **no password-reset / forgot-password flow** (only login/register in `app/auth/`); profile/password change is currently broken (SECURITY C1/H1).

## Seller journey
| Stage | Evidence | State | Gaps |
|---|---|---|---|
| Onboarding | `app/sell/**`, `seller_applications`, verification (`seller.ts:960-1024`) | Rich application + tiered verification | no step-by-step checklist / progress |
| Listing creation | `seller.ts:310-342`, variants, images, per-category schema | Strong | image upload is base64-in-DB (perf) |
| Inventory/stock | `seller.ts:490-613`, encrypted stock vault, manual stock | Strong (dedup by content hash) | low-stock alerts exist (`seller.ts:68`) |
| Orders | `seller.ts:735` | Good | — |
| Disputes | `disputes.ts`, seller_response | Present | — |
| Withdrawals | `wallet.ts`, `money.server.ts` | Functional | **race-unsafe (C3)**, **no 4-eyes (H5)**, weekly cap only |
| Storefront | `seller.ts:623-672` (banner/logo/socials) | Good premium touch | — |
| Analytics | `seller.ts:845-898` | Rich | heavy inline aggregates |

## Admin journey
| Area | Evidence | State |
|---|---|---|
| Moderation | `app/admin/moderation`, flagged messages (`admin.ts:966-989`), automod (`core.server.ts:172-200`) | Strong |
| Fraud/risk | `app/admin/risk`, `risk_events`, `fraud.server.ts` | Strong groundwork |
| Finance | `app/admin/finance`, withdrawals/deposits/credits/fx | Functional; **needs maker-checker** |
| Disputes | `app/admin/disputes` | Present |
| User mgmt | `admin.ts:726-791` (ban/role/level/freeze) | Strong; ban revokes sessions (`:745`) |
| Catalog/categories/coupons/payments/fx | `app/admin/**` | Comprehensive |

The admin surface is unusually complete for this stage (≈1907 lines in `admin.ts`).

## Cross-cutting marketplace gaps (priority)
1. **No cart / multi-item checkout** — conversion + AOV loss.
2. **No password reset** — support burden + churn; pairs with broken profile update (C1/H1).
3. **Single payment rail live** (USDT) — others disabled; broadens addressable market when enabled (with chargeback controls first).
4. **Manual-delivery proof + SLA enforcement** clarity.
5. **Empty states / onboarding checklists** (seller setup, buyer first-purchase) — see DESIGN.
6. **Trust signals on product/checkout** (escrow explainer, verified badge, refund policy) to lift conversion.

## Strengths
Escrow + dispute + warranty lifecycle, encrypted digital delivery, tiered seller trust/verification, fraud rules engine, referral/affiliate, loyalty credits, i18n/currency scaffolding, web-push PWA. The marketplace *model* is mature; the gaps are conversion plumbing (cart, password reset) and the money-path correctness bugs.
