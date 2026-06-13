# Platform Hardening + Configurability Roadmap

This is a large batch (19 items). I'll group them into phases so each ships verifiable, then iterate. Tell me which phase(s) to start with — or say "all" and I'll proceed top-to-bottom.

## Phase 1 — Privacy & PII protection (items 1, 2, 5, 7) ✅ DONE
- ✅ Buyer-facing seller cards on `s.$username.tsx` and product pages strip Telegram/Discord/Twitter/etc.; full socials stay visible in the seller's own storefront and admin views.
- ✅ Anti-PII automod set expanded in `core.server.ts` (phone, email, Telegram/Discord/WA/Signal, IBAN, off-platform payment / fee circumvention, external links). `chat.sendMessage` reads `automod_severity` from settings: hard-rejects buyer↔seller violations when set to `block` (default), or flags-only otherwise. Staff↔user threads remain exempt.
- ✅ `seller_verifications` got staff-only `contact_phone` (required), `contact_whatsapp`, `contact_telegram` columns. `seller.verification.tsx` collects them in a dedicated "Staff-only contact channels" block; `admin.verifications.tsx` surfaces them to reviewers.
- ✅ Persistent red banner inside `chat-box.tsx` warns both parties that sharing contacts / payment links forfeits escrow and triggers a ban.

## Phase 2 — Modern chat + presence + admin monitoring (items 6, 8, 9) ✅ DONE
- ✅ Rebuilt `chat-box.tsx`: header with avatar + green/grey presence dot + "online / seen Xm ago", day separators, grouped consecutive bubbles per sender with smooth radii, sender avatars on the buyer/seller side, typing/sending indicator while a message is in-flight, plus a new `readOnly` mode for staff transcript viewing. Input is auto-focused on mount and after each send.
- ✅ Added `users.last_seen_at` column and `pingPresence` / `getPresence` server fns in `chat.ts`. `useMe` pings every 60s while the tab is visible (paused when hidden) so background tabs don't fake "online". `getMessages` now returns the other party's `last_seen_at`; the chat header surfaces it live.
- ✅ New admin route `/admin/chats` — searchable cross-platform conversation list with "flagged only" filter, per-conversation message + flag counts, deep-link to order, and read-only transcript viewer that reuses `ChatBox` via the new staff-monitor mode. Wired into the admin top nav.

## Phase 3 — Vacation mode + listing hygiene (items 3, 4) ✅ DONE
- ✅ All public catalog surfaces now filter on `u.vacation_mode = 0 and u.is_banned = 0`: browseProducts, browseFacets, getMyRecommendations, getRelatedProducts, getFrequentlyBoughtTogether, getHomeData (trending/newest/topSellers/category counts), searchProducts, searchSuggest, getSellerLeaderboard, getFollowedFeed.
- ✅ New `filterAvailableSlugs` server fn; `index.tsx` recently-viewed rail now scrubs the localStorage cache against the server so removed/vacation/banned-seller products disappear from "Recently viewed".
- ✅ Public storefront (`s.$username.tsx`) hides all product listings while seller is on vacation and shows a friendly banner instead.
- ✅ Vacation toggle already lives in `account.tsx` settings; backed by `users.vacation_mode` updates in `auth.ts`.

## Phase 4 — Rich product submission + admin edit + SEO + commission config (items 10, 11, 12, 13, 19) ✅ DONE
- ✅ DB: `categories.submission_schema` (JSON), `products.category_attrs` (JSON), `products.admin_seo_description`.
- ✅ Admin categories page: JSON schema editor with one-click example template; per-category warranty + commission % already wired into order creation (uses `c.commission_pct` override).
- ✅ Seller new-product form fetches `getCategorySchema` and renders dynamic seller fields → persists to `products.category_attrs`.
- ✅ Product page renders dynamic buyer fields at checkout (encoded into `buyer_info` JSON), an admin "More about this listing" SEO panel, and a Specs table from `category_attrs`. `admin_seo_description` overrides meta/OG description.
- ✅ New admin route `/admin/products/$id/edit` — full CRUD on title/desc/category/price/warranty/qty/region/platform/required_info/status/category_attrs + admin SEO copy. Linked from the approvals queue.
- ✅ New server fns: `getCategorySchema`, `adminGetProduct`, `adminUpdateProduct`. `adminSaveCategory` extended with `submissionSchema`.

## Phase 5 — Credit system rebuild (item 16) ✅ DONE
- ✅ New tables `buyer_credits` + `credit_ledger` (audit trail with source/actor); `orders.credits_applied_cents` + `withdrawals.from_credits` flags.
- ✅ `lifecycle.refundOrder` now credits buyer-side refunds into `buyer_credits` via new `txRefundToCredits` (seller wallet logic unchanged). Notifications redirect buyers to `/account/credits`.
- ✅ New `src/lib/api/credits.ts`: `getMyCredits`, `payWithCredits` (full-cover instant checkout), `requestCreditWithdrawal` (2%/min $1 fee), plus admin `adminListCredits` / `adminGetUserCredits` / `adminAdjustCredits` (grant or revoke with audit reason).
- ✅ New buyer route `/account/credits` (balance card, withdrawal form, ledger history) + admin route `/admin/credits` (search, drill-down, adjust).
- ✅ Pay page (`pay.$orderId.tsx`) surfaces credit balance; full-cover "Pay with store credits" button, partial-cover info banner.
- ✅ Header user menu links to "Store credits" right under Wallet.

## Phase 6 — Order snapshot + delivery proof (items 17, 18) ✅ DONE
- ✅ `orders.product_snapshot` text column; `createOrder` freezes title, image, delivery type/SLA, warranty, region, platform, required_info, unit price, variant at checkout time.
- ✅ `getOrder` returns parsed `productSnapshot`; order page renders a "What was sold (frozen)" panel so buyers/sellers/staff see the immutable source of truth.
- ✅ New `order_attachments` table (id, order_id, uploader_id, uploader_role, kind, mime, data, note) + server fns `listOrderAttachments` / `addOrderAttachment` / `deleteOrderAttachment` / `getOrderAttachmentData` with 5 MB cap and image/video MIME allow-list.
- ✅ Order page gets an attachments grid with inline image/video previews and an uploader (kind: proof / before / after / evidence / misc + optional note). Both buyer and seller can upload; uploader's role and timestamp shown on every tile; uploader and staff can delete.

## Phase 7 — Auth + footer polish (items 14, 15) ✅ DONE
- ✅ Demo account block removed from `auth.tsx`; replaced bottom area with a clean Terms/Privacy link line.
- ✅ Footer rebuilt in `shell.tsx` as a 4-column link grid: Marketplace, Trust & safety, Money, Company — all wired to existing legal stub routes.

## Phase 8 — "Make everything configurable" sweep ✅ DONE
- ✅ Round 1: 6 new tunable columns (`credit_withdrawal_fee_pct`, `credit_withdrawal_min_fee_cents`, `attachment_max_mb`, `presence_ping_seconds`, `low_stock_threshold`, `dispute_sla_hours`), all wired into credits/attachments/presence, 5-tab admin settings panel.
- ✅ Round 2: Added `chat_rate_limit_per_min` + `automod_severity` columns. `chat.sendMessage` now reads both — rate cap is configurable, and admins can flip automod between **block** (hard-reject PII/off-platform attempts) and **flag-only** (let through but mark for staff review). `low_stock_threshold` + `dispute_sla_hours` now exposed via `getMe().banner` and rendered as live UI affordances: amber "ONLY N LEFT" badge on product cards, and SLA countdown / overdue badges on `/disputes` and `/admin/disputes`.

---

## Technical notes
- DB: SQLite/Postgres dual support via `db.server.ts` — all new tables use the same migration helper in `app.server.ts`.
- New columns/tables auto-created on boot via the schema bootstrap.
- All new admin pages gate via existing `isStaff(user)` check.
- Image/video uploads continue routing through `/api/public/img.$id` pattern (extend for video w/ size limit).

## Order of operations I recommend
1, 3, 7 first (quick wins, low risk).
Then 2 (chat rebuild — affects many pages).
Then 5 (credits — schema + checkout changes).
Then 4 (per-category schema — most code).
Then 6, 8 (snapshot + config sweep).

**Reply with phase numbers** (e.g. "1, 3, 7" or "all") and I'll start building.
