# Platform Hardening + Configurability Roadmap

This is a large batch (19 items). I'll group them into phases so each ships verifiable, then iterate. Tell me which phase(s) to start with — or say "all" and I'll proceed top-to-bottom.

## Phase 1 — Privacy & PII protection (items 1, 2, 5, 7)
- **Hide seller socials from buyers**: `s.$username.tsx` + product page seller card — strip Telegram/Discord/Twitter/etc. links for non-staff viewers. Keep visible in `seller.storefront.tsx` (seller's own view) and admin.
- **Anti-PII automod hard block** (`core.server.ts` `automodCheck`): expand pattern set (phone numbers intl format, emails, Telegram `@handles`, Discord tags, WhatsApp/wa.me, signal.me, IBAN, addresses). Currently flags soft — change `sendMessage` to **reject** (not just flag) for buyer↔seller messages, with toast: "Sharing personal info is prohibited." Staff↔user chats exempt.
- **Seller application contact fields**: add required `contact_phone`, `contact_whatsapp`, `contact_telegram` to seller verification form (`seller.verification.tsx`) — stored on `users` or `seller_profiles`, visible only to staff.
- **Strict chat banner**: persistent red banner at top of `ChatBox` for both parties: "⚠ Never share phone, email, Telegram, payment links, or account credentials. All messages are monitored. Violations = ban + forfeit escrow."

## Phase 2 — Modern chat + presence + admin monitoring (items 6, 8, 9)
- **Modern chat UI**: rebuild `chat-box.tsx` with bubble groups, avatars, day separators, typing indicator, read receipts (already have last_read), emoji reactions, file/image attach (escrow-safe — staff-only download for proof), reply quoting, in-line order card preview, auto-link to order actions.
- **Online presence**: add `users.last_seen_at`, ping every 30s from `<Shell/>` via a `pingPresence` server fn; green dot if `now - last_seen_at < 90s`, grey otherwise. Show in chat list, product seller card, storefront.
- **Admin chat monitor**: new `/admin/chats` page — searchable conversation list across whole platform, click to view full transcript (read-only), filter by flagged. Already have `canAccessConversation(staff=true)` — just expose UI.

## Phase 3 — Vacation mode + listing hygiene (items 3, 4)
- Filter `browse`, search, recently-viewed, recommendations, storefront public view: exclude products where `status != 'active'` OR `seller.vacation_mode = 1` OR `stock_count = 0`. Already partial — audit `catalog.ts`, `extras.ts` recently-viewed query, `growth.ts`.
- Add `users.vacation_mode` toggle in `seller.index.tsx` settings if not present.

## Phase 4 — Rich product submission + admin edit + SEO + commission config (items 10, 11, 12, 13, 19)
- **Per-category dynamic submission form**: extend `categories` with `submission_schema` (JSON) — admin defines required fields (e.g. "Region", "Subscription length", "Delivery method") per category in `admin.categories.tsx`. `seller.new-product.tsx` renders the schema dynamically. Saved in `products.category_attrs` (JSON).
- **Delivery-method config per category**: same schema engine — admin defines `delivery_methods` (instant/manual/hybrid) and `buyer_required_fields` (e.g. "Game username") per category. Checkout (`pay.$orderId.tsx`) collects these at purchase.
- **Admin product edit post-approval**: new `/admin/products/$id/edit` — full CRUD on title/desc/category/price/attrs.
- **SEO description override**: add `products.admin_seo_description` (long-form, admin-only) — rendered on `/p/$slug` below seller description, used in `<meta description>` and JSON-LD.
- **Per-category commission %**: add `categories.commission_bps` (basis points). Order creation reads category override first, falls back to global `platform_fee_bps`. Admin UI in `admin.categories.tsx`.

## Phase 5 — Credit system rebuild (item 16)
This is the biggest change. New architecture:
- New table `buyer_credits` (`user_id`, `balance_cents`, `source` enum: refund/promo/loyalty/topup, `expires_at` nullable).
- New ledger `credit_ledger` for audit trail.
- **Refund flow change** (`money.server.ts` `txRefund`): refund destination becomes `buyer_credits` by default, not wallet cash. Buyer can request "withdraw to original payment method" → creates a `withdrawal` against credits with admin approval (fee configurable).
- **Checkout** (`pay.$orderId.tsx`): show "Credits available: X USDT" with toggle "Apply credits". If applied, deduct from credits first, charge remainder via USDT. Order records `credits_applied_cents`.
- New `/account/credits` page: balance, history, withdrawal request button.
- Admin: `/admin/credits` to manually grant/revoke + view all balances.

## Phase 6 — Order snapshot + delivery proof (items 17, 18)
- **Snapshot on order create**: in `orders.ts` checkout, freeze `products` row JSON into `orders.product_snapshot` (title, description, image, attrs, price, delivery_terms). Show on `/orders/$orderId` and `/disputes/$orderId` as "what was sold". Read-only proof.
- **Delivery proof uploads**: extend `order_attachments` (or create) — seller can attach delivery screenshot/video at delivery time (already partial via chat?). Add "Upload proof" section on order page for both buyer and seller. Buyer uploads "before/after" screenshots. Staff can request more. All attachments visible in dispute view.

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
