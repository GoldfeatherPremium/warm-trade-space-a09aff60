import { q, q1, run } from "@/lib/server/db.server";
import { appContext } from "@/lib/server/app.server";
import { isStaff, type SessionUser } from "../auth";
import { now } from "@/lib/server/core.server";

export async function listConversations(user: SessionUser) {
  await appContext();
  const id = user.id;
  return q<{
    id: string;
    order_id: string | null;
    product_id: string | null;
    last_message_at: number | null;
    created_at: number;
    my_last_read: number;
    buyer_name: string;
    seller_name: string;
    buyer_last_seen: number;
    seller_last_seen: number;
    buyer_id: string;
    seller_id: string;
    order_no: string | null;
    product_title: string | null;
    order_status: string | null;
    order_total_cents: number | null;
    product_title_presale: string | null;
    product_price_cents: number | null;
    product_slug: string | null;
    image_key: string | null;
    last_body: string | null;
    last_sender_id: string | null;
    last_is_system: number | null;
    unread: number;
  }>(
    // CTE collapses the 3 duplicate correlated subqueries (last_body / last_sender_id /
    // last_is_system) into a single ranked scan of messages, reducing per-row DB work
    // from 4 subqueries to 1 (only unread count remains correlated).
    `with lm as (
       select m.conversation_id,
              m.body        as last_body,
              m.sender_id   as last_sender_id,
              m.is_system   as last_is_system,
              row_number() over (partition by m.conversation_id order by m.created_at desc) as rn
       from messages m
       where m.conversation_id in (
         select id from conversations where buyer_id = ? or seller_id = ?
       )
     )
     select cv.id, cv.order_id, cv.product_id, cv.last_message_at, cv.created_at,
            case when cv.buyer_id = ? then cv.buyer_last_read_at else cv.seller_last_read_at end as my_last_read,
            ub.username as buyer_name, us.username as seller_name,
            coalesce(ub.last_seen_at, 0) as buyer_last_seen,
            coalesce(us.last_seen_at, 0) as seller_last_seen,
            cv.buyer_id, cv.seller_id,
            o.order_no, o.product_title, o.status as order_status, o.total_cents as order_total_cents,
            p.title as product_title_presale, p.price_cents as product_price_cents, p.slug as product_slug,
            coalesce(o.image_key, p.image_key) as image_key,
            lm.last_body, lm.last_sender_id, lm.last_is_system,
            (select count(*) from messages m where m.conversation_id = cv.id
               and m.created_at > case when cv.buyer_id = ? then cv.buyer_last_read_at else cv.seller_last_read_at end
               and (m.sender_id is null or m.sender_id != ?)) as unread
     from conversations cv
     join users ub on ub.id = cv.buyer_id
     join users us on us.id = cv.seller_id
     left join orders o on o.id = cv.order_id
     left join products p on p.id = cv.product_id
     left join lm on lm.conversation_id = cv.id and lm.rn = 1
     where cv.buyer_id = ? or cv.seller_id = ?
     order by coalesce(cv.last_message_at, cv.created_at) desc limit 100`,
    [id, id, id, id, id, id, id],
  );
}

export async function getMessages(conversationId: string, user: SessionUser) {
  await appContext();
  const staff = isStaff(user);
  const c = await q1<{
    id: string;
    order_id: string | null;
    product_id: string | null;
    buyer_id: string;
    seller_id: string;
    buyer_last_read_at: number;
    seller_last_read_at: number;
  }>(`select * from conversations where id = ?`, [conversationId]);
  if (!c || (c.buyer_id !== user.id && c.seller_id !== user.id && !staff)) return null;

  const messages = await q<{
    id: string;
    sender_id: string | null;
    body: string;
    is_system: number;
    is_flagged: number;
    created_at: number;
    sender_name: string | null;
  }>(
    `select m.id, m.sender_id, m.body, m.is_system, m.is_flagged, m.created_at, u.username as sender_name
     from messages m left join users u on u.id = m.sender_id
     where m.conversation_id = ? order by m.created_at limit 500`,
    [conversationId],
  );

  // mark read
  const col =
    c.buyer_id === user.id
      ? "buyer_last_read_at"
      : c.seller_id === user.id
        ? "seller_last_read_at"
        : null;
  if (col) await run(`update conversations set ${col} = ? where id = ?`, [now(), conversationId]);

  const otherId = c.buyer_id === user.id ? c.seller_id : c.buyer_id;
  const other = await q1<{ username: string; last_seen_at: number }>(
    `select username, coalesce(last_seen_at,0) as last_seen_at from users where id = ?`,
    [otherId],
  );

  // pinned context card
  let card: Record<string, unknown> | null = null;
  if (c.order_id) {
    const o = await q1<Record<string, unknown>>(
      `select o.id as order_id, o.order_no, o.status, o.product_title as title,
              o.total_cents, o.qty, o.unit_price_cents, o.image_key, o.product_id,
              p.slug as product_slug
         from orders o left join products p on p.id = o.product_id
        where o.id = ?`,
      [c.order_id],
    );
    if (o) card = { kind: "order", ...o };
  } else if (c.product_id) {
    const p = await q1<Record<string, unknown>>(
      `select id as product_id, title, price_cents, image_key, slug as product_slug, status
         from products where id = ?`,
      [c.product_id],
    );
    if (p) card = { kind: "product", ...p };
  }

  return {
    messages,
    myId: user.id,
    otherId,
    otherName: other?.username ?? "",
    otherLastSeenAt: other?.last_seen_at ?? 0,
    orderId: c.order_id,
    card,
  };
}
