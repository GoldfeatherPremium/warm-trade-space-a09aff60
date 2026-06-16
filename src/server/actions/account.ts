"use server";

import { z } from "zod";
import { q, q1, run } from "@/lib/server/db.server";
import { appContext } from "@/lib/server/app.server";
import { decryptStock, hashPassword, now, verifyPassword } from "@/lib/server/core.server";
import { requireUser } from "../auth";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function updateProfileAction(input: {
  username?: string;
  currentPassword?: string;
  newPassword?: string;
}): Promise<ActionResult> {
  try {
    await appContext();
    const user = await requireUser();

    if (input.newPassword) {
      if (!input.currentPassword) return { ok: false, error: "Current password required." };
      if (input.newPassword.length < 8)
        return { ok: false, error: "New password must be at least 8 characters." };
      const row = await q1<{ password_hash: string }>(
        `select password_hash from users where id = ?`,
        [user.id],
      );
      // scrypt+salt verification — must match how register/login hash passwords
      // (core.server.hashPassword). Previously used unsalted SHA-256, which both
      // weakened security and never matched the stored scrypt hash.
      if (!row || !verifyPassword(input.currentPassword, row.password_hash))
        return { ok: false, error: "Current password is incorrect." };
      await run(`update users set password_hash = ? where id = ?`, [
        hashPassword(input.newPassword),
        user.id,
      ]);
    }

    if (input.username && input.username !== user.username) {
      const taken = await q1(
        `select 1 as x from users where lower(username) = lower(?) and id != ?`,
        [input.username, user.id],
      );
      if (taken) return { ok: false, error: "Username already taken." };
      await run(`update users set username = ? where id = ?`, [input.username, user.id]);
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function updatePreferencesAction(input: {
  locale: string;
  preferred_currency: string;
  country: string;
}): Promise<ActionResult> {
  try {
    await appContext();
    const user = await requireUser();
    await run(`update users set locale = ?, preferred_currency = ?, country = ? where id = ?`, [
      input.locale,
      input.preferred_currency,
      input.country || null,
      user.id,
    ]);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function getAccountDataAction() {
  await appContext();
  const user = await requireUser();
  const { getLoyaltySnapshot } = await import("@/lib/server/loyalty.server");
  const loyalty = await getLoyaltySnapshot(user.id);
  return { user, loyalty };
}

// ---------------------------------------------------------------------------
// Buyer subscriptions
// ---------------------------------------------------------------------------

export async function buyerListSubscriptionsAction() {
  await appContext();
  const user = await requireUser();
  const rows = await q<{
    id: string;
    product_id: string;
    product_title: string;
    seller_username: string;
    label: string;
    status: string;
    order_id: string | null;
    started_at: number | null;
    expires_at: number | null;
    credentials_encrypted: string;
  }>(
    `select s.*, p.title as product_title, u.username as seller_username
     from subscription_slots s
     join products p on p.id = s.product_id
     join users u on u.id = s.seller_id
     where s.buyer_id = ?
     order by case when s.status = 'active' then 0 else 1 end, s.expires_at desc`,
    [user.id],
  );
  const t = now();
  return rows.map((r) => {
    const expired = r.expires_at != null && r.expires_at < t;
    const active = r.status === "active" && !expired;
    return {
      id: r.id,
      productId: r.product_id,
      productTitle: r.product_title,
      sellerUsername: r.seller_username,
      label: r.label,
      status: expired ? "expired" : r.status,
      orderId: r.order_id,
      startedAt: r.started_at,
      expiresAt: r.expires_at,
      credentials: active ? decryptStock(r.credentials_encrypted) : null,
    };
  });
}
