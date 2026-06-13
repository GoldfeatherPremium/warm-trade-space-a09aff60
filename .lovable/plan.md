# Platform Hardening + Configurability Roadmap

This is a large batch (19 items). I'll group them into phases so each ships verifiable, then iterate. Tell me which phase(s) to start with — or say "all" and I'll proceed top-to-bottom.

## Phase 1 — Privacy & PII protection (items 1, 2, 5, 7)
- **Hide seller socials from buyers**: `s.$username.tsx` + product page seller card — strip Telegram/Discord/Twitter/etc. links for non-staff viewers. Keep visible in `seller.storefront.tsx` (seller's own view) and admin.
- **Anti-PII automod hard block** (`core.server.ts` `automodCheck`): expand pattern set (phone numbers intl format, emails, Telegram `@handles`, Discord tags, WhatsApp/wa.me, signal.me, IBAN, addresses). Currently flags soft — change `sendMessage` to **reject** (not just flag) for buyer↔seller messages, with toast: "Sharing personal info is prohibited." Staff↔user chats exempt.
- **Seller application contact fields**: add required `contact_phone`, `contact_whatsapp`, `contact_telegram` to seller verification form (`seller.verification.tsx`) — stored on `users` or `seller_profiles`, visible only to staff.
- **Strict chat banner**: persistent red banner at top of `ChatBox` for both parties: "⚠ Never share phone, email, Telegram, payment links, or account credentials. All messages are monitored. Violations = ban + forfeit escrow."

## Phase 2 — Modern chat + presence + admin monitoring (items 6, 8, 9) ✅ DONE
- ✅ Rebuilt `chat-box.tsx`: header with avatar + green/grey presence dot + "online / seen Xm ago", day separators, grouped consecutive bubbles per sender with smooth radii, sender avatars on the buyer/seller side, typing/sending indicator while a message is in-flight, plus a new `readOnly` mode for staff transcript viewing. Input is auto-focused on mount and after each send.
- ✅ Added `users.last_seen_at` column and `pingPresence` / `getPresence` server fns in `chat.ts`. `useMe` pings every 60s while the tab is visible (paused when hidden) so background tabs don't fake "online". `getMessages` now returns the other party's `last_seen_at`; the chat header surfaces it live.
- ✅ New admin route `/admin/chats` — searchable cross-platform conversation list with "flagged only" filter, per-conversation message + flag counts, deep-link to order, and read-only transcript viewer that reuses `ChatBox` via the new staff-monitor mode. Wired into the admin top nav.

## Phase 3 — Vacation mode + listing hygiene (items 3, 4) ✅ DONE
- ✅ All public catalog surfaces now filter on `u.vacation_mode = 0 and u.is_banned = 0`: browseProducts, browseFacets, getMyRecommendations, getRelatedProducts, getFrequentlyBoughtTogether, getHomeData (trending/newest/topSellers/category counts), searchProducts, searchSuggest, getSellerLeaderboard, getFollowedFeed.
- ✅ New `filterAvailableSlugs` server fn; `index.tsx` recently-viewed rail now scrubs the localStorage cache against the server so removed/vacation/banned-seller products disappear from "Recently viewed".
- ✅ Public storefront (`s.$username.tsx`) hides all product listings while seller is on vacation and shows a friendly banner instead.
- ✅ Vacation toggle already lives in `account.tsx` settings; backed by `users.vacation_mode` updates in `auth.ts`.

## Phase 4 — Rich product submission + admin edit + SEO + commission config (items 10, 11, 12, 13, 19)
- **Per-category dynamic submission form**: extend `categories` with `submission_schema` (JSON) — admin defines required fields (e.g. "Region", "Subscription length", "Delivery method") per category in `admin.categories.tsx`. `seller.new-product.tsx` renders the schema dynamically. Saved in `products.category_attrs` (JSON).
- **Delivery-method config per category**: same schema engine — admin defines `delivery_methods` (instant/manual/hybrid) and `buyer_required_fields` (e.g. "Game username") per category. Checkout (`pay.$orderId.tsx`) collects these at purchase.
- **Admin product edit post-approval**: new `/admin/products/$id/edit` — full CRUD on title/desc/category/price/attrs.
- **SEO description override**: add `products.admin_seo_description` (long-form, admin-only) — rendered on `/p/$slug` below seller description, used in `<meta description>` and JSON-LD.
- **Per-category commission %**: add `categories.commission_bps` (basis points). Order creation reads category override first, falls back to global `platform_fee_bps`. Admin UI in `admin.categories.tsx`.

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

## Phase 7 — Auth + footer polish (items 14, 15)
- Remove demo account block from `auth.tsx` bottom.
- Rebuild footer in `shell.tsx`: replace promo blurb with link grid → About, How escrow works, Fees, Seller guide, Buyer protection, Credits & refunds, Prohibited items, Terms, Privacy, Contact, Status. Create stub routes for each (`/about`, `/legal/terms`, etc.) with placeholder body + proper SEO heads.

## Phase 8 — "Make everything configurable" sweep
- Audit hardcoded numbers and copy. Move to `platform_settings` (already exists): warranty default hours per category, insurance default days, withdrawal min/fee, credit withdrawal fee, presence ping interval, automod severity threshold, max chat msgs/min, dispute SLA hours, low-stock threshold, "buyers chose this" trigger N, image upload size limits, etc.
- Build `/admin/settings` into a tabbed config panel: General, Fees & Commissions, Escrow & Warranty, Credits & Refunds, Chat & Moderation, Listings & Categories, SEO.

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
