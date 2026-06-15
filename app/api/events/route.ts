import { currentUser } from "@/server/auth";
import { q1 } from "@/lib/server/db.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const POLL_MS = 20_000;
const TIMEOUT_MS = 55_000; // just under typical 60s serverless limit

export async function GET() {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const userId = user.id;

  const stream = new ReadableStream({
    async start(ctrl) {
      const enc = new TextEncoder();
      const send = (data: unknown) => {
        try {
          ctrl.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // controller already closed
        }
      };

      const fetchCounts = async () => {
        try {
          const row = await q1<{ n: number; m: number }>(
            `select
               (select count(*) from notifications where user_id = ? and read_at is null) as n,
               (select count(*)
                  from messages msg
                  join conversations cv on cv.id = msg.conversation_id
                 where (cv.buyer_id = ? or cv.seller_id = ?)
                   and msg.created_at > case when cv.buyer_id = ? then cv.buyer_last_read_at else cv.seller_last_read_at end
                   and (msg.sender_id is null or msg.sender_id != ?)) as m`,
            [userId, userId, userId, userId, userId],
          );
          return { n: Number(row?.n ?? 0), m: Number(row?.m ?? 0) };
        } catch {
          return null;
        }
      };

      // Send immediately on connect
      const initial = await fetchCounts();
      if (initial) send(initial);

      // Heartbeat + poll loop
      const start = Date.now();
      while (Date.now() - start < TIMEOUT_MS) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        const counts = await fetchCounts();
        if (!counts) break;
        send(counts);
      }

      // Signal client to reconnect
      try {
        ctrl.enqueue(enc.encode(`event: done\ndata: {}\n\n`));
        ctrl.close();
      } catch {
        // already closed
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
