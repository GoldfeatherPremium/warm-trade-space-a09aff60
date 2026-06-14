import { createServerFn } from "@tanstack/react-start";
import { q } from "../server/db.server";
import { appContext } from "../server/app.server";
import { requireUser } from "../server/auth.server";
import { getWallet, getBuyerCredits } from "../server/money.server";
import { getLoyaltySnapshot } from "../server/loyalty.server";

// Orders that still need the buyer's attention vs. ones that are settled.
const ACTIVE_STATUSES = ["awaiting_payment", "paid", "delivering", "delivered", "disputed"];
const COMPLETED_STATUSES = ["completed", "released"];
// Statuses where the buyer has a concrete next action to take.
const ACTION_STATUSES = ["awaiting_payment", "delivered"];

/**
 * Aggregated buyer "home" — order stats, spendable balances, loyalty and the
 * most recent purchases — in a single round-trip so the dashboard renders fast.
 */
export const getBuyerDashboard = createServerFn({ method: "GET" }).handler(async () => {
  await appContext();
  const user = await requireUser();
  const id = user.id;

  const [byStatus, recent, favRow, followRow, wallet, credits, loyalty] = await Promise.all([
    q<{ status: string; c: number; s: number }>(
      `select status, count(*) as c, coalesce(sum(total_cents), 0) as s
         from orders where buyer_id = ? group by status`,
      [id],
    ),
    q<{
      id: string;
      order_no: string;
      product_title: string;
      image_key: string | null;
      status: string;
      total_cents: number;
      created_at: number;
      counterparty: string;
    }>(
      `select o.id, o.order_no, o.product_title, o.image_key, o.status, o.total_cents, o.created_at,
              u.username as counterparty
         from orders o join users u on u.id = o.seller_id
        where o.buyer_id = ? order by o.created_at desc limit 6`,
      [id],
    ),
    q<{ c: number }>(`select count(*) as c from favorites where user_id = ?`, [id]),
    q<{ c: number }>(`select count(*) as c from seller_follows where user_id = ?`, [id]),
    getWallet(id),
    getBuyerCredits(id),
    getLoyaltySnapshot(id),
  ]);

  let totalOrders = 0;
  let activeOrders = 0;
  let completedOrders = 0;
  let actionNeeded = 0;
  let openDisputes = 0;
  let totalSpentCents = 0;
  for (const r of byStatus) {
    const c = Number(r.c);
    totalOrders += c;
    if (ACTIVE_STATUSES.includes(r.status)) activeOrders += c;
    if (COMPLETED_STATUSES.includes(r.status)) {
      completedOrders += c;
      totalSpentCents += Number(r.s);
    }
    if (ACTION_STATUSES.includes(r.status)) actionNeeded += c;
    if (r.status === "disputed") openDisputes += c;
  }

  return {
    stats: {
      totalOrders,
      activeOrders,
      completedOrders,
      actionNeeded,
      openDisputes,
      totalSpentCents,
      favorites: Number(favRow[0]?.c ?? 0),
      following: Number(followRow[0]?.c ?? 0),
    },
    wallet: { available_cents: wallet.available_cents },
    credits: { balance_cents: credits.balance_cents },
    loyalty,
    recent,
  };
});
