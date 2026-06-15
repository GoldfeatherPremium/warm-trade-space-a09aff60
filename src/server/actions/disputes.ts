"use server";

import { q1, run } from "@/lib/server/db.server";
import { appContext } from "@/lib/server/app.server";
import { audit, notify, now, uid } from "@/lib/server/core.server";
import { isStaff, requireUser } from "../auth";
import { z } from "zod";

const STAFF_ROLES = ["admin", "support", "finance"];

async function loadDispute(orderId: string) {
  const o = await q1<{
    id: string;
    order_no: string;
    buyer_id: string;
    seller_id: string;
    total_cents: number;
    status: string;
  }>(
    `select id, order_no, product_title, buyer_id, seller_id, total_cents, status from orders where id = ?`,
    [orderId],
  );
  if (!o) return { o: null, d: null };
  const d = await q1<{ id: string; status: string; seller_response: string | null }>(
    `select id, status, seller_response from disputes where order_id = ?`,
    [orderId],
  );
  return { o, d };
}

export async function addDisputeEvidenceAction(input: {
  orderId: string;
  kind: "screenshot" | "log" | "delivery_proof" | "chat_excerpt" | "other";
  title: string;
  body?: string;
  url?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await appContext();
    const user = await requireUser();
    const { o, d } = await loadDispute(input.orderId);
    if (!o) return { ok: false, error: "Order not found." };
    if (!d) return { ok: false, error: "No dispute on this order." };
    if (d.status === "resolved") return { ok: false, error: "Dispute already resolved." };
    if (o.buyer_id !== user.id && o.seller_id !== user.id && !isStaff(user))
      return { ok: false, error: "Access denied." };

    const role = isStaff(user) ? "staff" : o.buyer_id === user.id ? "buyer" : "seller";
    const t = now();
    await run(
      `insert into dispute_evidence (id, dispute_id, author_id, author_role, kind, title, body, url, created_at) values (?,?,?,?,?,?,?,?,?)`,
      [
        uid(),
        d.id,
        user.id,
        role,
        input.kind,
        input.title,
        input.body ?? null,
        input.url ?? null,
        t,
      ],
    );
    await run(`update disputes set last_activity_at = ? where id = ?`, [t, d.id]);
    const targets =
      role === "buyer"
        ? [o.seller_id]
        : role === "seller"
          ? [o.buyer_id]
          : [o.buyer_id, o.seller_id];
    for (const uid_ of targets) {
      await notify(
        uid_,
        "dispute_update",
        "New evidence on dispute",
        `${o.order_no}: ${input.title}`,
        `/disputes/${o.id}`,
      );
    }
    await audit(user.id, "dispute.evidence", "dispute", d.id, { kind: input.kind });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function postDisputeMessageAction(input: {
  orderId: string;
  body: string;
  internal?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await appContext();
    const user = await requireUser();
    const { o, d } = await loadDispute(input.orderId);
    if (!o || !d) return { ok: false, error: "Dispute not found." };
    if (d.status === "resolved") return { ok: false, error: "Dispute already resolved." };
    if (o.buyer_id !== user.id && o.seller_id !== user.id && !isStaff(user))
      return { ok: false, error: "Access denied." };

    const role = isStaff(user) ? "staff" : o.buyer_id === user.id ? "buyer" : "seller";
    const isInternal = input.internal && role === "staff" ? 1 : 0;
    const t = now();
    await run(
      `insert into dispute_messages (id, dispute_id, author_id, author_role, body, is_internal, created_at) values (?,?,?,?,?,?,?)`,
      [uid(), d.id, user.id, role, input.body, isInternal, t],
    );
    await run(`update disputes set last_activity_at = ? where id = ?`, [t, d.id]);
    if (!isInternal) {
      const targets =
        role === "buyer"
          ? [o.seller_id]
          : role === "seller"
            ? [o.buyer_id]
            : [o.buyer_id, o.seller_id];
      for (const uid_ of targets) {
        await notify(
          uid_,
          "dispute_update",
          "New message on dispute",
          o.order_no,
          `/disputes/${o.id}`,
        );
      }
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
