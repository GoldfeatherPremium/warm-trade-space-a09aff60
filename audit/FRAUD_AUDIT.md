# FRAUD_AUDIT.md — X-VAULT Marketplace

Money paths traced through `src/lib/server/money.server.ts`, `coupons.server.ts`, `growth.server.ts`, `loyalty.server.ts`, `fraud.server.ts`, `src/server/actions/orders.ts`, `seller.ts`, `wallet.ts`, `disputes.ts`. Evidence is cited `file:line`. Unconfirmable items marked **UNVERIFIED**.

## Confirmed money-loss / integrity defects (cross-ref SECURITY_AUDIT)
1. **Double affiliate payout** — broken idempotency query (`growth.server.ts:37-41`, columns `ref_id`/`kind` do not exist). See SECURITY C2. **Direct fund leakage.**
2. **Withdrawal/credit double-spend race** — non-atomic balance check (`money.server.ts:141-162, 279-289`). See SECURITY C3. **Direct fund leakage under concurrency.**
3. **No 4-eyes on withdrawals** — single finance actor can approve+send (`admin.ts:619-650`). See SECURITY H5. **Insider theft.**

## What is actually solid (verified)
- Escrow state machine is transactional: hold/release/refund all in `tx()` with `pending_cents`/`available_cents` columns and ledger writes (`money.server.ts:44-138`). Refund checks `pending >= originalNet` before reversing (`:104`).
- Stock reservation is atomic & race-safe: `update stock_items set status='reserved' ... where status='available' and id in (select ... limit ?) returning id` inside `tx()` (`orders.ts:159-169`) — the conditional `where status='available'` prevents two buyers claiming the same item.
- Coupon global cap is atomic: `update coupons set used_count = used_count+1 where id=? and (max_uses=0 or used_count<max_uses) returning id` (`orders.ts:189-193`).
- Review requires a real order and is unique: `reviews.order_id` is `unique` (`db.server.ts:606-607`); insert checks `select 1 from reviews where order_id=?` (`orders.ts:505`). Fake reviews without a paid order are not possible.
- Deterministic risk engine auto-holds high-risk orders (`fraud.server.ts:29-127`, `HOLD_THRESHOLD=70`).
- Adjustments refuse to make balances negative (`money.server.ts:191`).

## Top attack scenarios (prioritised)

### Tier 1 — financially exploitable today
1. **Affiliate double-dip** via C2: get a release re-run / retried release path to re-credit commission (no working dedup).
2. **Concurrent withdrawal drain** via C3: fire N parallel withdrawal requests for full balance; check passes N times.
3. **Insider payout fraud** via H5: finance role approves+sends own/colluding withdrawal.
4. **Coupon farming** (`coupons.server.ts`, no per-user cap): one buyer reuses a % coupon across unlimited orders (M3).
5. **Referral signup/purchase farming**: N self-created accounts; `referral_clicks.fingerprint` always null (`growth.server.ts:15`), no device correlation (M4).

### Tier 2 — abuse / quality, no direct theft
6. Fake delivery for **manual** delivery types: seller marks delivered without genuine goods → buyer must dispute (escrow protects funds until release/warranty, but seller can stall). **UNVERIFIED** exact manual-delivery proof requirement.
7. Dispute spam / extortion: rate-limited by risk score (dispute count adds risk) but a buyer can open one dispute per order; `disputes.opened_by` velocity tracked (`fraud.server.ts:90-97`).
8. Refund-rate gaming: buyers under 30% refund rate evade the signal (`fraud.server.ts:105-111`).
9. Trust-score manipulation: trust recomputed from sales/disputes; gameable by wash trades between colluding buyer/seller accounts (self-funded orders that release). **UNVERIFIED** full trust formula (`trust.server.ts` not exhaustively traced).
10. Click fraud on referral links inflating `click_count` (`growth.server.ts:17`) — cosmetic unless payouts ever key on clicks.
11. New-account high-value purchase: partially mitigated by age/value rules (`fraud.server.ts:48-57`), but thresholds are static and known once observed.
12. Multi-account loyalty/credit harvesting: `buyer_credits` granted via promo/refund; no cross-account identity check.
13. Chargeback abuse on the (scaffolded) card rail: card payment is disabled today (`db.server.ts:1294`), so chargeback risk is latent until enabled — **design now**.
14. Coupon + sale + credits stacking to drive order total to ~0 then dispute for cash refund-to-credits loop. **UNVERIFIED** stacking math; review `orders.ts` discount application.
15. Self-purchase to inflate `sold_count`/seller ranking (cheap if seller refunds own order after ranking boost).

*(Scenarios 16–50: variants of the above across each role and each money primitive — withdrawal, deposit, credit, escrow, coupon, referral, loyalty, review, dispute — combined with the multi-account vector. The controlling fixes are the same five Tier-1 items plus identity/device fingerprinting.)*

## Recommended controls
- **Identity:** device/IP fingerprint at signup, login, order, withdrawal; correlate referral & multi-account abuse.
- **Velocity ceilings:** per-actor daily withdrawal cap; per-user coupon cap; per-IP signup cap.
- **Payout safety:** maker-checker, payout clawback on downstream chargeback/refund, deferred affiliate payout window.
- **Make C2/C3 fixes blocking before launch.**
