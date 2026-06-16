# Plan: Admin-configurable categories & seller listing controls

## 1. Admin → Categories (per-category configuration)

Extend `admin.categories.tsx` + `adminSaveCategory` so each category stores:

- **Delivery type** (controls what seller uploads & what buyer sees):
  - `code` — redeem code / gift card code (current default; bulk text upload)
  - `credentials` — email + password pair (account top-ups, shared accounts)
  - `invite` — seller enters buyer's email to send invite; buyer provides email at checkout
  - `giftcard_image` — uploaded gift card image/PDF
  - `manual_text` — free-form text blob seller fills per order (one-off accounts, custom delivery)
- **Subscription required?** boolean. If true → seller MUST pick a duration on each listing.
- **Allowed subscription durations** (multi-select from: 7d, 14d, 1m, 3m, 6m, 12m, lifetime).
- **Admin general description** (long-form, used for SEO meta + shown on category landing & on product pages as "About this category").
- Existing `sellerFields` / `buyerFields` JSON schema stays — admin can still add per-category dynamic fields (e.g. region selector for invites).

## 2. Admin → Products (per-product overrides)

`admin.products_.$id.edit.tsx` already has `adminSeoDescription`. Add:

- **Delivery type override** (defaults to category's).
- **Subscription duration override** (if category is subscription).
- Existing min/max qty stay.

## 3. Seller → New / Edit product

`seller.new-product.tsx`:

- Read category config; render:
  - **Subscription duration selector** (only if category requires it; options = admin's allowed list).
  - **Min quantity per order** (default 1).
  - **Max orders at a time** (cap per checkout).
  - **Available stock** number — but for delivery types with discrete inventory (`code`, `credentials`, `giftcard_image`), stock is **derived** from uploaded items, not editable. For `invite` / `manual_text`, stock is a manual number the seller maintains.
- Hide irrelevant fields based on category's delivery type.

## 4. Seller → Stock manager (`seller.stock.$productId.tsx`)

Adapt UI per delivery type:

- `code` → existing bulk textarea (unchanged).
- `credentials` → rows of `email | password` (CSV-style: `email:password` per line).
- `giftcard_image` → image upload list.
- `invite` / `manual_text` → no pre-uploaded stock; show "Stock is fulfilled per order from your seller dashboard" + manual stock counter.
- Show **remaining (available) / reserved / delivered** counts (already present, keep).

## 5. Order fulfillment (delivery)

For `invite` / `manual_text` orders, seller fills delivery details in `seller.orders.tsx` per order. Once `delivered_at` is set:

- DB constraint + server check blocks further edits to `stock_items.payload` / order delivery payload.
- UI hides edit controls; shows read-only.

## 6. Buyer checkout

`pay.$orderId.tsx` (or checkout flow) uses category's `buyerFields` (already wired) — for `invite` type the admin schema includes a required "Recipient email" field; for `credentials` top-up types it may include "Your account email".

## 7. Database changes (migration)

```sql
alter table categories
  add column delivery_type text not null default 'code',
  add column requires_subscription boolean not null default false,
  add column allowed_durations text[] not null default '{}',
  add column admin_description text;

alter table products
  add column delivery_type text,                 -- nullable = inherit category
  add column subscription_duration text,         -- e.g. '7d','1m','12m','lifetime'
  add column max_orders_at_once int not null default 10,
  add column manual_stock int;                   -- only used for invite/manual_text

alter table stock_items
  add column locked_at timestamptz;              -- set when delivered; blocks edits
```

Server: `removeStockItem` / any stock-edit fn rejects when `locked_at is not null` OR `status='delivered'`.

## 8. Files to edit

- `src/lib/api/admin.ts` — extend `adminSaveCategory`, `adminUpdateProduct`; new fields in `adminListItems`/`adminGetProduct` returns.
- `src/lib/api/catalog.ts` — expose new category fields to seller/buyer.
- `src/lib/api/seller.ts` — accept new listing fields; validate against category config; per-delivery-type stock upload paths; lock on delivery.
- `src/routes/admin.categories.tsx` — new form fields.
- `src/routes/admin.products_.$id.edit.tsx` — delivery override + duration.
- `src/routes/seller.new-product.tsx` — duration + qty + stock fields, conditional rendering.
- `src/routes/seller.stock.$productId.tsx` — per-delivery-type UI.
- `src/routes/seller.orders.tsx` — manual delivery entry for `invite`/`manual_text`; lock after delivered.
- `src/components/dynamic-fields.tsx` — already generic, no change.
- One new migration.

## Open questions

1. **Subscription duration UX**: should buyers see the duration on the product card / checkout (yes by default)? And does ordering quantity=N of a "1 month" sub mean N months stacked, or N separate 1-month subs delivered to different recipients?
2. **Gift card image**: do you want admin to also accept PDF, or images only?
3. **Max orders at a time** — is this _per buyer per product_ (rate-limit) or _per single checkout_ (cart cap)?
4. **`invite` flow**: who actually sends the invite — seller manually after order, or automated email from the platform using seller-supplied API/instructions?

Answer those four and I'll implement end-to-end.
