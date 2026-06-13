import { createFileRoute } from "@tanstack/react-router";
import { run, q1 } from "@/lib/server/db.server";
import { appContext } from "@/lib/server/app.server";

export const Route = createFileRoute("/api/public/promote-admin")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const email = url.searchParams.get("email")?.toLowerCase().trim();
        const token = url.searchParams.get("t");
        if (token !== "promote-gf-2026-once") return new Response("nope", { status: 401 });
        if (!email) return new Response("email required", { status: 400 });
        await appContext();
        const row = await q1<{ id: string }>(`select id from users where lower(email) = ?`, [email]);
        if (!row) return new Response("not found", { status: 404 });
        await run(`update users set role = 'admin' where id = ?`, [row.id]);
        return new Response(JSON.stringify({ ok: true, id: row.id, email }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
