import { currentUser } from "@/server/auth";
import { q1 } from "@/lib/server/db.server";

export const dynamic = "force-dynamic";

export async function GET() {
  const u = await currentUser();
  if (!u) return Response.json({ messages: 0, notifications: 0 });

  const [msgRow, notifRow] = await Promise.all([
    q1<{ c: number }>(
      `select coalesce(sum(
         (select count(*) from messages m
          where m.conversation_id = cv.id
            and m.created_at > (case when cv.buyer_id = ? then cv.buyer_last_read_at else cv.seller_last_read_at end)
            and (m.sender_id is null or m.sender_id != ?))
       ), 0) as c
       from conversations cv where cv.buyer_id = ? or cv.seller_id = ?`,
      [u.id, u.id, u.id, u.id],
    ),
    q1<{ c: number }>(
      `select count(*) c from notifications where user_id = ? and read_at is null`,
      [u.id],
    ),
  ]);

  return Response.json({
    messages: Number(msgRow?.c ?? 0),
    notifications: Number(notifRow?.c ?? 0),
  });
}
