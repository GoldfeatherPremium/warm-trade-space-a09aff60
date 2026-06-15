// Framework-agnostic buyer read layer (userId in, data out). Reuses the exact
// SQL from the legacy api/dashboard.ts and api/orders.ts; the RSC page handles
// auth (currentUser) and passes the id.
import { q } from "@/lib/server/db.server";
import { appContext } from "@/lib/server/app.server";
import { getWallet, getBuyerCredits } from "@/lib/server/money.server";
import { getLoyaltySnapshot } from "@/lib/server/loyalty.server";

const ACTIVE_STATUSES = ["awaiting_payment", "paid", "delivering", "delivered", "disputed"];
const COMPLETED_STATUSES = ["completed", "released"];
const ACTION_STATUSES = ["awaiting_payment", "delivered"];

export async function getBuyerDashboardData(id: string) {
  await appContext();
  const [byStatus, recent, countsRow, wallet, credits, loyalty] = await Promise.all([
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
    // Single round-trip for both counts instead of two separate queries
    q<{ favorites: number; following: number }>(
      `select (select count(*) from favorites where user_id = ?) as favorites,
              (select count(*) from seller_follows where user_id = ?) as following`,
      [id, id],
    ),
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
      favorites: Number(countsRow[0]?.favorites ?? 0),
      following: Number(countsRow[0]?.following ?? 0),
    },
    wallet: { available_cents: wallet.available_cents },
    credits: { balance_cents: credits.balance_cents },
    loyalty,
    recent,
  };
}

export interface BuyerOrderRow {
  id: string;
  order_no: string;
  product_title: string;
  image_key: string | null;
  status: string;
  total_cents: number;
  qty: number;
  created_at: number;
  counterparty: string;
}

export async function listBuyerOrders(id: string): Promise<BuyerOrderRow[]> {
  await appContext();
  return q<BuyerOrderRow>(
    `select o.id, o.order_no, o.product_title, o.image_key, o.status, o.total_cents, o.qty,
            o.created_at, u.username as counterparty
       from orders o join users u on u.id = o.seller_id
      where o.buyer_id = ? order by o.created_at desc limit 200`,
    [id],
  );
}
