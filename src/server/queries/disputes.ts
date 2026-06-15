import { q, q1 } from "@/lib/server/db.server";
import { appContext } from "@/lib/server/app.server";
import { isStaff, type SessionUser } from "../auth";

export async function listUserDisputes(user: SessionUser) {
  await appContext();
  const staff = isStaff(user);
  const where = staff ? "" : `where o.buyer_id = '${user.id}' or o.seller_id = '${user.id}'`;
  return q<{
    id: string;
    order_id: string;
    order_no: string;
    product_title: string;
    buyer: string;
    seller: string;
    reason: string;
    status: string;
    priority: string;
    created_at: number;
    resolution: string | null;
    total_cents: number;
  }>(
    `select d.id, d.order_id, o.order_no, o.product_title,
            ub.username as buyer, us.username as seller,
            d.reason, d.status, d.priority, d.created_at, d.resolution,
            o.total_cents
     from disputes d
     join orders o on o.id = d.order_id
     join users ub on ub.id = o.buyer_id
     join users us on us.id = o.seller_id
     ${where}
     order by d.created_at desc limit 100`,
    [],
  );
}

export async function getDisputeThread(orderId: string, user: SessionUser) {
  await appContext();
  const staff = isStaff(user);
  const o = await q1<{
    id: string;
    order_no: string;
    product_title: string;
    buyer_id: string;
    seller_id: string;
    total_cents: number;
    status: string;
    escrow_status: string;
    escrow_hold_reason: string | null;
    warranty_ends_at: number | null;
    paid_at: number | null;
  }>(
    `select id, order_no, product_title, buyer_id, seller_id, total_cents, status,
            escrow_status, escrow_hold_reason, warranty_ends_at, paid_at
     from orders where id = ?`,
    [orderId],
  );
  if (!o) return null;
  if (o.buyer_id !== user.id && o.seller_id !== user.id && !staff) return null;

  const d = await q1<{
    id: string;
    reason: string;
    description: string | null;
    seller_response: string | null;
    status: string;
    resolution: string | null;
    resolution_cents: number | null;
    priority: string;
    staff_owner: string | null;
    created_at: number;
    resolved_at: number | null;
    opened_by: string;
  }>(`select * from disputes where order_id = ?`, [orderId]);

  if (!d) return { myRole: roleFor(user, o), order: o, dispute: null, evidence: [], messages: [] };

  const [evidence, msgs] = await Promise.all([
    q<{
      id: string;
      author_role: string;
      kind: string;
      title: string;
      body: string | null;
      url: string | null;
      created_at: number;
      author_name: string;
    }>(
      `select e.id, e.author_role, e.kind, e.title, e.body, e.url, e.created_at, u.username as author_name
       from dispute_evidence e join users u on u.id = e.author_id
       where dispute_id = ? order by created_at asc`,
      [d.id],
    ),
    q<{
      id: string;
      author_role: string;
      body: string;
      is_internal: number;
      created_at: number;
      author_name: string;
    }>(
      `select m.id, m.author_role, m.body, m.is_internal, m.created_at, u.username as author_name
       from dispute_messages m join users u on u.id = m.author_id
       where dispute_id = ? order by created_at asc`,
      [d.id],
    ),
  ]);

  const role = roleFor(user, o);
  const messages = role === "staff" ? msgs : msgs.filter((m) => m.is_internal === 0);

  return { myRole: role, order: o, dispute: d, evidence, messages };
}

function roleFor(
  user: SessionUser,
  o: { buyer_id: string; seller_id: string },
): "buyer" | "seller" | "staff" {
  if (isStaff(user)) return "staff";
  if (user.id === o.buyer_id) return "buyer";
  return "seller";
}
