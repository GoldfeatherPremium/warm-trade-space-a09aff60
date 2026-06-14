import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { q, q1, run } from "../server/db.server";
import { appContext } from "../server/app.server";
import { automodCheck, fail, notify, now, uid } from "../server/core.server";
import { isStaff, requireUser } from "../server/auth.server";

interface ConversationRow {
  id: string;
  order_id: string | null;
  product_id: string | null;
  buyer_id: string;
  seller_id: string;
  buyer_last_read_at: number;
  seller_last_read_at: number;
}

/** Pinned context shown at the top of a conversation. */
export type ConversationCard =
  | {
      kind: "order";
      order_id: string;
      order_no: string;
      status: string;
      title: string;
      total_cents: number;
      qty: number;
      unit_price_cents: number;
      image_key: string | null;
      product_id: string;
      product_slug: string | null;
    }
  | {
      kind: "product";
      product_id: string;
      title: string;
      price_cents: number;
      image_key: string | null;
      product_slug: string | null;
      status: string;
    };

async function canAccessConversation(userId: string, convId: string, staff: boolean) {
  const c = await q1<ConversationRow>(`select * from conversations where id = ?`, [convId]);
  if (!c) return null;
  if (c.buyer_id !== userId && c.seller_id !== userId && !staff) return null;
  return c;
}

export const listConversations = createServerFn({ method: "GET" }).handler(async () => {
  await appContext();
  const user = await requireUser();
  const id = user.id;
  const rows = await q<Record<string, string | number | null>>(
    `select cv.id, cv.order_id, cv.product_id, cv.last_message_at, cv.created_at,
            case when cv.buyer_id = ? then cv.buyer_last_read_at else cv.seller_last_read_at end as my_last_read,
            ub.username as buyer_name, us.username as seller_name,
            coalesce(ub.last_seen_at, 0) as buyer_last_seen,
            coalesce(us.last_seen_at, 0) as seller_last_seen,
            cv.buyer_id, cv.seller_id,
            o.order_no, o.product_title, o.status as order_status, o.total_cents as order_total_cents,
            p.title as product_title_presale, p.price_cents as product_price_cents, p.slug as product_slug,
            coalesce(o.image_key, p.image_key) as image_key,
            (select body from messages m where m.conversation_id = cv.id order by m.created_at desc limit 1) as last_body,
            (select sender_id from messages m where m.conversation_id = cv.id order by m.created_at desc limit 1) as last_sender_id,
            (select is_system from messages m where m.conversation_id = cv.id order by m.created_at desc limit 1) as last_is_system,
            (select count(*) from messages m where m.conversation_id = cv.id
               and m.created_at > case when cv.buyer_id = ? then cv.buyer_last_read_at else cv.seller_last_read_at end
               and (m.sender_id is null or m.sender_id != ?)) as unread
     from conversations cv
     join users ub on ub.id = cv.buyer_id
     join users us on us.id = cv.seller_id
     left join orders o on o.id = cv.order_id
     left join products p on p.id = cv.product_id
     where cv.buyer_id = ? or cv.seller_id = ?
     order by coalesce(cv.last_message_at, cv.created_at) desc limit 100`,
    [id, id, id, id, id],
  );
  return { conversations: rows, myId: id };
});

export const getMessages = createServerFn({ method: "GET" })
  .inputValidator(z.object({ conversationId: z.string() }))
  .handler(async ({ data }) => {
    await appContext();
    const user = await requireUser();
    const c = await canAccessConversation(user.id, data.conversationId, isStaff(user));
    if (!c) fail("Conversation not found.");
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
      [data.conversationId],
    );
    // mark read
    const col =
      c!.buyer_id === user.id
        ? "buyer_last_read_at"
        : c!.seller_id === user.id
          ? "seller_last_read_at"
          : null;
    if (col)
      await run(`update conversations set ${col} = ? where id = ?`, [now(), data.conversationId]);
    const otherId = c!.buyer_id === user.id ? c!.seller_id : c!.buyer_id;
    const other = (await q1<{ username: string; last_seen_at: number }>(
      `select username, coalesce(last_seen_at,0) as last_seen_at from users where id = ?`,
      [otherId],
    ))!;

    // Pinned context card: the related order (preferred) or, for pre-sale
    // chats, the product the buyer enquired about.
    let card: ConversationCard | null = null;
    if (c!.order_id) {
      const o = await q1<{
        order_id: string;
        order_no: string;
        status: string;
        title: string;
        total_cents: number;
        qty: number;
        unit_price_cents: number;
        image_key: string | null;
        product_id: string;
        product_slug: string | null;
      }>(
        `select o.id as order_id, o.order_no, o.status, o.product_title as title,
                o.total_cents, o.qty, o.unit_price_cents, o.image_key, o.product_id,
                p.slug as product_slug
           from orders o left join products p on p.id = o.product_id
          where o.id = ?`,
        [c!.order_id],
      );
      if (o) card = { kind: "order", ...o };
    } else if (c!.product_id) {
      const p = await q1<{
        product_id: string;
        title: string;
        price_cents: number;
        image_key: string | null;
        product_slug: string | null;
        status: string;
      }>(
        `select id as product_id, title, price_cents, image_key, slug as product_slug, status
           from products where id = ?`,
        [c!.product_id],
      );
      if (p) card = { kind: "product", ...p };
    }

    return {
      messages,
      myId: user.id,
      otherId,
      otherName: other.username,
      otherLastSeenAt: other.last_seen_at,
      orderId: c!.order_id,
      card,
    };
  });

export const sendMessage = createServerFn({ method: "POST" })
  .inputValidator(z.object({ conversationId: z.string(), body: z.string().min(1).max(3000) }))
  .handler(async ({ data }) => {
    await appContext();
    const user = await requireUser();
    const c = await canAccessConversation(user.id, data.conversationId, isStaff(user));
    if (!c) fail("Conversation not found.");
    const { getSettings } = await import("../server/core.server");
    const settings = await getSettings();
    const limit = Math.max(1, settings.chat_rate_limit_per_min ?? 20);
    const recent = (await q1<{ cnt: number }>(
      `select count(*) cnt from messages where sender_id = ? and created_at > ?`,
      [user.id, now() - 60_000],
    ))!.cnt;
    if (recent >= limit) fail("You're sending messages too quickly.");

    const flagReason = automodCheck(data.body);
    const senderIsStaff = isStaff(user);
    const hardBlock = (settings.automod_severity ?? "block") === "block";
    // Staff are exempt; otherwise apply configured severity.
    if (flagReason && !senderIsStaff && hardBlock) {
      fail(
        `Message blocked: sharing ${flagReason} is strictly prohibited. All trades, payments and chat must stay on X-VAULT — violations forfeit escrow and result in a permanent ban.`,
      );
    }
    await run(
      `insert into messages (id, conversation_id, sender_id, body, is_flagged, flag_reason, created_at) values (?,?,?,?,?,?,?)`,
      [uid(), data.conversationId, user.id, data.body, flagReason ? 1 : 0, flagReason, now()],
    );
    await run(`update conversations set last_message_at = ? where id = ?`, [
      now(),
      data.conversationId,
    ]);

    const recipient = c!.buyer_id === user.id ? c!.seller_id : c!.buyer_id;
    await notify(
      recipient,
      "chat",
      `New message from ${user.username}`,
      data.body.slice(0, 80),
      `/chat?c=${data.conversationId}`,
    );
    return { ok: true, flagged: !!flagReason };
  });

/** Pre-sale "Chat with seller" from a product page. */
export const startProductConversation = createServerFn({ method: "POST" })
  .inputValidator(z.object({ productId: z.string() }))
  .handler(async ({ data }) => {
    await appContext();
    const user = await requireUser();
    const { rateLimit } = await import("../server/rate-limit.server");
    rateLimit({ key: `convo-start:${user.id}`, limit: 15, windowMs: 60_000 });

    const p = await q1<{ id: string; seller_id: string }>(
      `select id, seller_id from products where id = ?`,
      [data.productId],
    );
    if (!p) fail("Product not found.");
    if (p!.seller_id === user.id) fail("You can't chat with yourself.");
    const existing = await q1<{ id: string }>(
      `select id from conversations where product_id = ? and buyer_id = ? and order_id is null`,
      [data.productId, user.id],
    );
    if (existing) return { conversationId: existing.id };
    const id = uid();
    await run(
      `insert into conversations (id, product_id, buyer_id, seller_id, created_at) values (?,?,?,?,?)`,
      [id, data.productId, user.id, p!.seller_id, now()],
    );
    return { conversationId: id };
  });

// ---------------------------------------------------------------------------
// Presence — lightweight "online dot" signal.
// Clients ping every ~60s while the tab is active. We consider a user
// "online" if their last_seen_at is within the last 120 seconds.
// ---------------------------------------------------------------------------
export const PRESENCE_WINDOW_MS = 120_000;

export const pingPresence = createServerFn({ method: "POST" }).handler(async () => {
  await appContext();
  const user = await requireUser();
  await run(`update users set last_seen_at = ? where id = ?`, [now(), user.id]);
  return { ok: true, at: now() };
});

export const getPresence = createServerFn({ method: "POST" })
  .inputValidator(z.object({ userIds: z.array(z.string()).max(50) }))
  .handler(async ({ data }) => {
    await appContext();
    await requireUser();
    if (data.userIds.length === 0) return { presence: {} as Record<string, number> };
    const placeholders = data.userIds.map(() => "?").join(",");
    const rows = await q<{ id: string; last_seen_at: number }>(
      `select id, coalesce(last_seen_at,0) as last_seen_at from users where id in (${placeholders})`,
      data.userIds,
    );
    const presence: Record<string, number> = {};
    for (const r of rows) presence[r.id] = r.last_seen_at;
    return { presence };
  });

// ---------------------------------------------------------------------------
// Admin: cross-platform chat monitor. Staff-only.
// ---------------------------------------------------------------------------
export const adminListConversations = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      q: z.string().max(80).optional(),
      flaggedOnly: z.boolean().optional(),
      limit: z.number().int().min(10).max(200).default(50),
    }),
  )
  .handler(async ({ data }) => {
    await appContext();
    const user = await requireUser();
    if (!isStaff(user)) fail("Staff access required.");
    const where: string[] = [];
    const params: Array<string | number> = [];
    if (data.q) {
      const like = `%${data.q.toLowerCase()}%`;
      where.push(
        `(lower(ub.username) like ? or lower(us.username) like ? or lower(coalesce(o.order_no,'')) like ?)`,
      );
      params.push(like, like, like);
    }
    if (data.flaggedOnly) {
      where.push(
        `exists (select 1 from messages m where m.conversation_id = cv.id and m.is_flagged = 1)`,
      );
    }
    const whereSql = where.length ? `where ${where.join(" and ")}` : "";
    params.push(data.limit);
    const rows = await q<Record<string, string | number | null>>(
      `select cv.id, cv.order_id, cv.product_id, cv.created_at, cv.last_message_at,
              ub.username as buyer_name, us.username as seller_name,
              o.order_no, o.status as order_status,
              (select count(*) from messages m where m.conversation_id = cv.id) as msg_count,
              (select count(*) from messages m where m.conversation_id = cv.id and m.is_flagged = 1) as flagged_count,
              (select body from messages m where m.conversation_id = cv.id order by m.created_at desc limit 1) as last_body
         from conversations cv
         join users ub on ub.id = cv.buyer_id
         join users us on us.id = cv.seller_id
         left join orders o on o.id = cv.order_id
         ${whereSql}
         order by coalesce(cv.last_message_at, cv.created_at) desc
         limit ?`,
      params,
    );
    return { conversations: rows };
  });
