import { currentUser } from "@/server/auth";
import { run } from "@/lib/server/db.server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });

  let body: { endpoint?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  if (body.endpoint) {
    await run(`delete from push_subscriptions where endpoint = ? and user_id = ?`, [
      body.endpoint,
      user.id,
    ]);
  }
  return Response.json({ ok: true });
}
