import { q1, run } from "./db.server";
import { now, sha256 } from "./core.server";
import { txAdjustment } from "./money.server";

/** Public: record a referral click (called from /r/$code redirect serverFn).
 * `ip` is hashed with the UA into a coarse fingerprint so referral/affiliate
 * abuse (self-referral farms, click fraud) can be detected and deduped later —
 * previously this column was always null. */
export async function recordReferralClick(
  code: string,
  ua: string | null,
  country: string | null,
  ip: string | null = null,
): Promise<{ ok: boolean; refId: string | null }> {
  const r = await q1<{ id: string }>(`select id from referrals where code = ?`, [code]);
  if (!r) return { ok: false, refId: null };
  const fingerprint = ip || ua ? sha256(`${ip ?? ""}|${ua ?? ""}`) : null;
  await run(
    `insert into referral_clicks (referral_id, fingerprint, user_agent, country, created_at) values (?,?,?,?,?)`,
    [r.id, fingerprint, (ua ?? "").slice(0, 200), country, now()],
  );
  await run(`update referrals set click_count = click_count + 1 where id = ?`, [r.id]);
  return { ok: true, refId: r.id };
}

/** Credit referrer wallet when attributed buyer's order is released. Idempotent. */
export async function maybePayoutReferralForOrder(
  buyerId: string,
  orderId: string,
  orderTotalCents: number,
): Promise<void> {
  const attr = await q1<{ referral_id: string }>(
    `select referral_id from referral_attributions where user_id = ?`,
    [buyerId],
  );
  if (!attr) return;
  const ref = await q1<{ id: string; owner_user_id: string; commission_pct: number }>(
    `select id, owner_user_id, commission_pct from referrals where id = ?`,
    [attr.referral_id],
  );
  if (!ref) return;
  // Idempotency: wallet_ledger has columns (user_id, order_id, type), NOT
  // (ref_id, kind). The previous query referenced non-existent columns, so it
  // either threw or never matched — risking a duplicate payout on every release
  // of the same order. Match the real schema and the order_id recorded below.
  const already = await q1(
    `select 1 from wallet_ledger where user_id = ? and order_id = ? and type = 'adjustment'`,
    [ref.owner_user_id, orderId],
  );
  if (already) return;
  const payout = Math.floor((orderTotalCents * ref.commission_pct) / 100);
  if (payout <= 0) return;
  await txAdjustment(ref.owner_user_id, payout, `Affiliate commission · ${orderId}`, orderId);
  await run(
    `update referrals set purchase_count = purchase_count + 1, earnings_cents = earnings_cents + ? where id = ?`,
    [payout, ref.id],
  );
}
