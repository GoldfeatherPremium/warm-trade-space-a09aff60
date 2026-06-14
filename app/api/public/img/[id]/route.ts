import { q1 } from "@/lib/server/db.server";

/**
 * Serves a seller-uploaded product image. Public, read-only. Image bytes live
 * inline in `product_images` as base64; decode to bytes and serve with the
 * original mime type. (Ported from the TanStack route handler.)
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const row = await q1<{ mime: string; data: string }>(
    `select mime, data from product_images where id = ?`,
    [id],
  );
  if (!row) return new Response("Not found", { status: 404 });
  const binary = Uint8Array.from(atob(row.data), (c) => c.charCodeAt(0));
  return new Response(binary, {
    status: 200,
    headers: {
      "content-type": row.mime,
      "cache-control": "public, max-age=2592000, immutable",
    },
  });
}
