import { currentUser } from "@/server/auth";
import { q1, run } from "@/lib/server/db.server";
import { randomUUID } from "node:crypto";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });

  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { endpoint, keys } = body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return Response.json({ ok: false, error: "Missing fields" }, { status: 400 });
  }

  // Upsert: update user_id if endpoint already exists (re-subscription)
  const existing = await q1<{ id: string }>(
    `select id from push_subscriptions where endpoint = ?`,
    [endpoint],
  );
  if (existing) {
    await run(
      `update push_subscriptions set user_id = ?, p256dh = ?, auth = ? where endpoint = ?`,
      [user.id, keys.p256dh, keys.auth, endpoint],
    );
  } else {
    await run(
      `insert into push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at) values (?,?,?,?,?,?)`,
      [randomUUID(), user.id, endpoint, keys.p256dh, keys.auth, Date.now()],
    );
  }
  return Response.json({ ok: true });
}
