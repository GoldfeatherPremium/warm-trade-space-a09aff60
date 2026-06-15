"use server";

import { q1, run } from "@/lib/server/db.server";
import { appContext } from "@/lib/server/app.server";
import { automodCheck, fail, notify, now, uid } from "@/lib/server/core.server";
import { isStaff, requireUser } from "../auth";
import { rateLimit } from "@/lib/server/rate-limit.server";
import { getSettings } from "@/lib/server/core.server";

export async function sendMessageAction(conversationId: string, body: string) {
  await appContext();
  const user = await requireUser();
  const c = await q1<{ id: string; buyer_id: string; seller_id: string }>(
    `select id, buyer_id, seller_id from conversations where id = ?`,
    [conversationId],
  );
  if (!c || (c.buyer_id !== user.id && c.seller_id !== user.id && !isStaff(user)))
    return { ok: false as const, error: "Conversation not found." };

  const settings = await getSettings();
  const limit = Math.max(1, settings.chat_rate_limit_per_min ?? 20);
  const recent = (await q1<{ cnt: number }>(
    `select count(*) cnt from messages where sender_id = ? and created_at > ?`,
    [user.id, now() - 60_000],
  ))!.cnt;
  if (recent >= limit) return { ok: false as const, error: "You're sending messages too quickly." };

  const flagReason = automodCheck(body);
  const senderIsStaff = isStaff(user);
  const hardBlock = (settings.automod_severity ?? "block") === "block";
  if (flagReason && !senderIsStaff && hardBlock) {
    return {
      ok: false as const,
      error: `Message blocked: sharing ${flagReason} is strictly prohibited. All trades must stay on X-VAULT.`,
    };
  }

  await run(
    `insert into messages (id, conversation_id, sender_id, body, is_flagged, flag_reason, created_at) values (?,?,?,?,?,?,?)`,
    [uid(), conversationId, user.id, body, flagReason ? 1 : 0, flagReason, now()],
  );
  await run(`update conversations set last_message_at = ? where id = ?`, [now(), conversationId]);

  const recipient = c.buyer_id === user.id ? c.seller_id : c.buyer_id;
  await notify(
    recipient,
    "chat",
    `New message from ${user.username}`,
    body.slice(0, 80),
    `/chat?c=${conversationId}`,
  );
  return { ok: true as const, flagged: !!flagReason };
}

export async function pingPresenceAction() {
  await appContext();
  const user = await requireUser();
  await run(`update users set last_seen_at = ? where id = ?`, [now(), user.id]);
  return { ok: true };
}

export async function getMessagesAction(conversationId: string) {
  await appContext();
  const user = await requireUser();
  const { getMessages } = await import("../queries/chat");
  return getMessages(conversationId, user);
}

export async function startProductConversationAction(productId: string) {
  await appContext();
  const user = await requireUser();
  rateLimit({ key: `convo-start:${user.id}`, limit: 15, windowMs: 60_000 });

  const p = await q1<{ id: string; seller_id: string }>(
    `select id, seller_id from products where id = ?`,
    [productId],
  );
  if (!p) fail("Product not found.");
  if (p!.seller_id === user.id) fail("You can't chat with yourself.");

  const existing = await q1<{ id: string }>(
    `select id from conversations where product_id = ? and buyer_id = ? and order_id is null`,
    [productId, user.id],
  );
  if (existing) return { conversationId: existing.id };

  const id = uid();
  await run(
    `insert into conversations (id, product_id, buyer_id, seller_id, created_at) values (?,?,?,?,?)`,
    [id, productId, user.id, p!.seller_id, now()],
  );
  return { conversationId: id };
}
