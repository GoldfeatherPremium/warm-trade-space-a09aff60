import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { q, q1, run, tx } from "../server/db.server";
import { appContext } from "../server/app.server";
import { audit, fail, now, uid } from "../server/core.server";
import { isStaff, requireUser } from "../server/auth.server";
import { rateLimit } from "../server/rate-limit.server";
import {
  getBuyerCredits,
  txCreditGrant,
  txCreditSpend,
} from "../server/money.server";
import { confirmPayment, getOrderRow } from "../server/lifecycle.server";

export interface CreditLedgerRow {
  id: number;
  user_id: string;
  order_id: string | null;
  type: string;
  amount_cents: number;
  balance_after_cents: number;
  source: string | null;
  note: string | null;
  created_at: number;
}

// ---------------------------------------------------------------------------
// Buyer-facing
// ---------------------------------------------------------------------------
export const getMyCredits = createServerFn({ method: "GET" }).handler(async () => {
  await appContext();
  const user = await requireUser();
  const c = await getBuyerCredits(user.id);
  const ledger = await q<CreditLedgerRow>(
    `select id, user_id, order_id, type, amount_cents, balance_after_cents, source, note, created_at
       from credit_ledger where user_id = ? order by created_at desc limit 100`,
    [user.id],
  );
  const pendingWithdrawal = await q1<{ id: string; amount_cents: number; created_at: number }>(
    `select id, amount_cents, created_at from withdrawals
      where user_id = ? and from_credits = 1 and status = 'pending' order by created_at desc limit 1`,
    [user.id],
  );
  return { balance: c.balance_cents, ledger, pendingWithdrawal: pendingWithdrawal ?? null };
});

/** Pay an order entirely from credit balance (requires full coverage). */
export const payWithCredits = createServerFn({ method: "POST" })
  .inputValidator(z.object({ orderId: z.string() }))
  .handler(async ({ data }) => {
    await appContext();
    const user = await requireUser();
    rateLimit({ key: `creditpay:${user.id}`, limit: 10, windowMs: 60_000 });
    const o = await getOrderRow(data.orderId);
    if (!o || o.buyer_id !== user.id) fail("Order not found.");
    if (o!.status !== "awaiting_payment") fail("This order is not awaiting payment.");
    if (o!.expires_at && o!.expires_at < now())
      fail("The payment window for this order has expired.");
    const c = await getBuyerCredits(user.id);
    if (c.balance_cents < o!.total_cents)
      fail(
        `Insufficient credits: ${(c.balance_cents / 100).toFixed(2)} available, ${(o!.total_cents / 100).toFixed(2)} needed.`,
      );
    await tx(async () => {
      await txCreditSpend(
        user.id,
        o!.total_cents,
        o!.id,
        `Credits applied to ${o!.order_no}`,
      );
      await run(
        `update orders set credits_applied_cents = ? where id = ?`,
        [o!.total_cents, o!.id],
      );
      await run(`update deposits set status = 'confirmed', tx_hash = ? where order_id = ?`, [
        `credits:${uid().slice(0, 18)}`,
        o!.id,
      ]);
    });
    await confirmPayment(o!.id);
    await audit(user.id, "order.credit_pay", "order", o!.id);
    return { ok: true };
  });

/** Request a withdrawal back to original payment rail (admin-approved). */
export const requestCreditWithdrawal = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      amountCents: z.number().int().min(100),
      address: z.string().min(8).max(120),
      network: z.enum(["TRC20", "BEP20"]).default("TRC20"),
    }),
  )
  .handler(async ({ data }) => {
    await appContext();
    const user = await requireUser();
    rateLimit({ key: `creditwd:${user.id}`, limit: 5, windowMs: 60_000 });
    const c = await getBuyerCredits(user.id);
    const settings = await getSettings();
    const feeCents = Math.max(
      settings.credit_withdrawal_min_fee_cents,
      Math.round(data.amountCents * (settings.credit_withdrawal_fee_pct / 100)),
    );
    if (c.balance_cents < data.amountCents + feeCents)
      fail(
        `Insufficient credits to cover amount + ${(feeCents / 100).toFixed(2)} USDT fee.`,
      );
    const wid = uid();
    await tx(async () => {
      await run(
        `update buyer_credits set balance_cents = balance_cents - ?, updated_at = ? where user_id = ?`,
        [data.amountCents + feeCents, now(), user.id],
      );
      const updated = (await q1<{ balance_cents: number }>(
        `select balance_cents from buyer_credits where user_id = ?`,
        [user.id],
      ))!;
      await run(
        `insert into credit_ledger (user_id, order_id, type, amount_cents, balance_after_cents, source, note, created_at)
         values (?,?,?,?,?,?,?,?)`,
        [
          user.id,
          null,
          "withdrawal",
          -(data.amountCents + feeCents),
          updated.balance_cents,
          "withdrawal",
          `Withdrawal ${wid.slice(0, 8)} requested (incl. ${(feeCents / 100).toFixed(2)} fee)`,
          now(),
        ],
      );
      await run(
        `insert into withdrawals (id, user_id, amount_cents, fee_cents, address, network, status, from_credits, created_at)
         values (?,?,?,?,?,?, 'pending', 1, ?)`,
        [wid, user.id, data.amountCents, feeCents, data.address, data.network, now()],
      );
    });
    await audit(user.id, "credits.withdrawal_request", "withdrawal", wid, {
      amountCents: data.amountCents,
      feeCents,
    });
    return { ok: true, id: wid };
  });

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
export const adminListCredits = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      q: z.string().max(60).optional(),
      withBalanceOnly: z.boolean().default(true),
    }),
  )
  .handler(async ({ data }) => {
    await appContext();
    const user = await requireUser();
    if (!isStaff(user)) fail("Staff only.");
    const needle = `%${(data.q ?? "").toLowerCase()}%`;
    const rows = await q<{
      user_id: string;
      username: string;
      email: string;
      balance_cents: number;
      updated_at: number;
    }>(
      `select bc.user_id, u.username, u.email, bc.balance_cents, bc.updated_at
         from buyer_credits bc join users u on u.id = bc.user_id
        where (? = '%%' or lower(u.username) like ? or lower(u.email) like ?)
          and (? = 0 or bc.balance_cents > 0)
        order by bc.balance_cents desc, bc.updated_at desc limit 200`,
      [needle, needle, needle, data.withBalanceOnly ? 1 : 0],
    );
    return { rows };
  });

export const adminGetUserCredits = createServerFn({ method: "GET" })
  .inputValidator(z.object({ userId: z.string() }))
  .handler(async ({ data }) => {
    await appContext();
    const user = await requireUser();
    if (!isStaff(user)) fail("Staff only.");
    const c = await getBuyerCredits(data.userId);
    const u = await q1<{ username: string; email: string }>(
      `select username, email from users where id = ?`,
      [data.userId],
    );
    const ledger = await q<CreditLedgerRow>(
      `select id, user_id, order_id, type, amount_cents, balance_after_cents, source, note, created_at
         from credit_ledger where user_id = ? order by created_at desc limit 200`,
      [data.userId],
    );
    return { user: u, balance: c.balance_cents, ledger };
  });

export const adminAdjustCredits = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      userId: z.string(),
      amountCents: z.number().int(),
      note: z.string().min(3).max(500),
    }),
  )
  .handler(async ({ data }) => {
    await appContext();
    const user = await requireUser();
    if (!isStaff(user)) fail("Staff only.");
    if (data.amountCents === 0) fail("Amount cannot be zero.");
    if (data.amountCents > 0) {
      await txCreditGrant(
        data.userId,
        data.amountCents,
        "adjustment",
        `Admin grant: ${data.note}`,
        null,
        user.id,
      );
    } else {
      const c = await getBuyerCredits(data.userId);
      if (c.balance_cents + data.amountCents < 0)
        fail("Adjustment would make credit balance negative.");
      await tx(async () => {
        await run(
          `update buyer_credits set balance_cents = balance_cents + ?, updated_at = ? where user_id = ?`,
          [data.amountCents, now(), data.userId],
        );
        const updated = (await q1<{ balance_cents: number }>(
          `select balance_cents from buyer_credits where user_id = ?`,
          [data.userId],
        ))!;
        await run(
          `insert into credit_ledger (user_id, order_id, type, amount_cents, balance_after_cents, source, note, actor_id, created_at)
           values (?,?,?,?,?,?,?,?,?)`,
          [
            data.userId,
            null,
            "adjustment",
            data.amountCents,
            updated.balance_cents,
            "adjustment",
            `Admin revoke: ${data.note}`,
            user.id,
            now(),
          ],
        );
      });
    }
    await audit(user.id, "credits.adjust", "user", data.userId, {
      amountCents: data.amountCents,
      note: data.note,
    });
    return { ok: true };
  });
