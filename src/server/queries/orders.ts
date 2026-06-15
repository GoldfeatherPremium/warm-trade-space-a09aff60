// Framework-agnostic order reads for the pay + order-detail pages. Ports
// getPayment / getOrder; the RSC page passes the authenticated user.
import { q, q1 } from "@/lib/server/db.server";
import { appContext } from "@/lib/server/app.server";
import { getOrCreateOrderConversation, getSettings } from "@/lib/server/core.server";
import { getOrderRow } from "@/lib/server/lifecycle.server";
import { isStaff, type SessionUser } from "../auth";

export async function getPaymentData(orderId: string, user: SessionUser) {
  await appContext();
  const o = await getOrderRow(orderId);
  if (!o || (o.buyer_id !== user.id && !isStaff(user))) return null;
  const deposit = (await q1<{
    id: string;
    amount_cents: number;
    network: string;
    pay_address: string;
    status: string;
    expires_at: number;
    tx_hash: string | null;
  }>(`select * from deposits where order_id = ? order by created_at desc limit 1`, [orderId]))!;
  const seller = await q1<{
    username: string;
    verification_tier: "unverified" | "verified" | "business" | "premium";
    trust_score: number;
    seller_level: number;
    total_sales: number;
    completion_rate: number;
  }>(
    `select username, verification_tier, trust_score, seller_level, total_sales, completion_rate
       from users where id = ?`,
    [o.seller_id],
  );
  const product = await q1<{ warranty_hours: number; delivery_sla_minutes: number }>(
    `select coalesce(p.warranty_hours, c.default_warranty_hours) as warranty_hours,
            p.delivery_sla_minutes
       from products p join categories c on c.id = p.category_id where p.id = ?`,
    [o.product_id],
  );
  return {
    order: o,
    deposit,
    seller: seller ?? null,
    warrantyHours: product?.warranty_hours ?? 24,
    deliverySlaMinutes: product?.delivery_sla_minutes ?? 60,
  };
}

type Snap = {
  product_id?: string;
  title?: string;
  image_key?: string | null;
  delivery_type?: string;
  delivery_sla_minutes?: number;
  warranty_hours?: number;
  region?: string | null;
  platform?: string | null;
  required_info?: string | null;
  unit_price_cents?: number;
  variant_title?: string | null;
  captured_at?: number;
};

export async function getOrderData(orderId: string, user: SessionUser) {
  await appContext();
  const o = await getOrderRow(orderId);
  if (!o || (o.buyer_id !== user.id && o.seller_id !== user.id && !isStaff(user))) return null;
  const isBuyer = o.buyer_id === user.id;
  const [deliveries, dispute, review, buyer, seller, conversationId, settings] = await Promise.all([
    q<{
      id: string;
      type: string;
      payload: string | null;
      note: string | null;
      created_at: number;
    }>(
      `select id, type, payload, note, created_at from order_deliveries where order_id = ? order by created_at`,
      [orderId],
    ),
    q1<{
      id: string;
      reason: string;
      description: string | null;
      seller_response: string | null;
      status: string;
      resolution: string | null;
      resolution_cents: number | null;
      created_at: number;
      resolved_at: number | null;
      opened_by: string;
    }>(`select * from disputes where order_id = ?`, [orderId]),
    q1<{ rating: number; comment: string | null; seller_reply: string | null; created_at: number }>(
      `select rating, comment, seller_reply, created_at from reviews where order_id = ?`,
      [orderId],
    ),
    q1<{ username: string }>(`select username from users where id = ?`, [o.buyer_id]),
    q1<{ username: string }>(`select username from users where id = ?`, [o.seller_id]),
    getOrCreateOrderConversation(orderId),
    getSettings(),
  ]);
  const staff = isStaff(user);
  const safeDeliveries = deliveries.map((del) => ({
    ...del,
    payload:
      isBuyer || staff ? del.payload : del.payload ? "•••• (visible to buyer)" : null,
  }));
  let snapshot: Snap | null = null;
  const snapRaw = (o as unknown as { product_snapshot?: string | null }).product_snapshot;
  if (snapRaw) {
    try {
      snapshot = JSON.parse(snapRaw) as Snap;
    } catch {
      snapshot = null;
    }
  }
  return {
    order: o,
    deliveries: safeDeliveries,
    dispute: dispute ?? null,
    review: review ?? null,
    buyerName: buyer!.username,
    sellerName: seller!.username,
    conversationId,
    viewerIsBuyer: isBuyer,
    viewerIsSeller: o.seller_id === user.id,
    autoConfirmHours: settings.auto_confirm_hours,
    productSnapshot: snapshot,
  };
}
