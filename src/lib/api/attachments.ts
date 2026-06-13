import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { q, q1, run } from "../server/db.server";
import { appContext } from "../server/app.server";
import { audit, fail, now, uid } from "../server/core.server";
import { isStaff, requireUser } from "../server/auth.server";
import { rateLimit } from "../server/rate-limit.server";
import { getOrderRow } from "../server/lifecycle.server";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB raw
const ALLOWED_MIME = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
];
const KINDS = ["proof", "before", "after", "evidence", "misc"] as const;
type Kind = (typeof KINDS)[number];

async function assertAccess(orderId: string, userId: string, staff: boolean) {
  const o = await getOrderRow(orderId);
  if (!o) fail("Order not found.");
  if (!staff && o!.buyer_id !== userId && o!.seller_id !== userId) fail("Order not found.");
  return o!;
}

export const listOrderAttachments = createServerFn({ method: "GET" })
  .inputValidator(z.object({ orderId: z.string() }))
  .handler(async ({ data }) => {
    await appContext();
    const user = await requireUser();
    await assertAccess(data.orderId, user.id, isStaff(user));
    const rows = await q<{
      id: string;
      uploader_id: string;
      uploader_role: string;
      kind: string;
      mime: string;
      note: string | null;
      created_at: number;
    }>(
      `select id, uploader_id, uploader_role, kind, mime, note, created_at
         from order_attachments where order_id = ? order by created_at asc`,
      [data.orderId],
    );
    return { attachments: rows };
  });

export const addOrderAttachment = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      orderId: z.string(),
      mime: z.string().min(3).max(40),
      kind: z.enum(KINDS),
      dataBase64: z.string().min(16).max(Math.ceil((MAX_BYTES * 4) / 3) + 1024),
      note: z.string().max(500).optional(),
    }),
  )
  .handler(async ({ data }) => {
    await appContext();
    const user = await requireUser();
    rateLimit({ key: `attach:${user.id}`, limit: 30, windowMs: 60_000 });
    if (!ALLOWED_MIME.includes(data.mime))
      fail("Unsupported file type. Use PNG, JPEG, WebP, GIF, MP4, or WebM.");
    const approxBytes = Math.floor((data.dataBase64.length * 3) / 4);
    if (approxBytes > MAX_BYTES) fail("File is too large (5 MB max).");
    const staff = isStaff(user);
    const o = await assertAccess(data.orderId, user.id, staff);
    const role = staff
      ? "staff"
      : o.buyer_id === user.id
        ? "buyer"
        : "seller";
    const id = uid();
    await run(
      `insert into order_attachments (id, order_id, uploader_id, uploader_role, kind, mime, data, note, created_at)
       values (?,?,?,?,?,?,?,?,?)`,
      [id, data.orderId, user.id, role, data.kind as Kind, data.mime, data.dataBase64, data.note ?? null, now()],
    );
    await audit(user.id, "order.attachment_add", "order", data.orderId, {
      kind: data.kind,
      mime: data.mime,
    });
    return { id };
  });

export const deleteOrderAttachment = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    await appContext();
    const user = await requireUser();
    const a = await q1<{ uploader_id: string; order_id: string }>(
      `select uploader_id, order_id from order_attachments where id = ?`,
      [data.id],
    );
    if (!a) fail("Attachment not found.");
    if (a!.uploader_id !== user.id && !isStaff(user)) fail("Not allowed.");
    await run(`delete from order_attachments where id = ?`, [data.id]);
    await audit(user.id, "order.attachment_delete", "order", a!.order_id, { id: data.id });
    return { ok: true };
  });
