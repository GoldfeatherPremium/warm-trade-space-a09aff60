"use server";

import { z } from "zod";
import { q, q1, run } from "@/lib/server/db.server";
import { appContext } from "@/lib/server/app.server";
import { decryptStock, hashPassword, verifyPassword, now } from "@/lib/server/core.server";
import { requireUser } from "../auth";
import { cookies } from "next/headers";

type ActionResult = { ok: true } | { ok: false; error: string };

const SUPPORTED_LOCALES = ["en", "es", "fr", "de", "pt", "ru", "zh", "ja", "ko", "ar"] as const;
const SUPPORTED_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "BRL",
  "INR",
  "NGN",
  "RUB",
  "IDR",
  "PHP",
  "TRY",
] as const;

const updateProfileSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(24)
    .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers and underscore only")
    .optional(),
  currentPassword: z.string().max(100).optional(),
  newPassword: z.string().min(8).max(100).optional(),
});

export async function updateProfileAction(
  input: z.infer<typeof updateProfileSchema>,
): Promise<ActionResult> {
  try {
    await appContext();
    const user = await requireUser();
    const data = updateProfileSchema.parse(input);

    if (data.newPassword) {
      if (!data.currentPassword) return { ok: false, error: "Current password required." };
      const row = await q1<{ password_hash: string }>(
        `select password_hash from users where id = ?`,
        [user.id],
      );
      if (!row || !verifyPassword(data.currentPassword, row.password_hash))
        return { ok: false, error: "Current password is incorrect." };
      await run(`update users set password_hash = ? where id = ?`, [
        hashPassword(data.newPassword),
        user.id,
      ]);
      // Invalidate all other sessions so stolen sessions can't persist after a
      // password change. Keep the current session active for smooth UX.
      const store = await cookies();
      const currentToken = store.get("xv_session")?.value;
      if (currentToken) {
        await run(`delete from sessions where user_id = ? and token != ?`, [
          user.id,
          currentToken,
        ]);
      } else {
        await run(`delete from sessions where user_id = ?`, [user.id]);
      }
    }

    if (data.username && data.username !== user.username) {
      const taken = await q1(
        `select 1 as x from users where lower(username) = lower(?) and id != ?`,
        [data.username, user.id],
      );
      if (taken) return { ok: false, error: "Username already taken." };
      await run(`update users set username = ? where id = ?`, [data.username, user.id]);
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

const updatePreferencesSchema = z.object({
  locale: z.enum(SUPPORTED_LOCALES).default("en"),
  preferred_currency: z.enum(SUPPORTED_CURRENCIES).default("USD"),
  country: z
    .string()
    .regex(/^[A-Z]{2}$/, "Must be a 2-letter ISO country code")
    .nullable()
    .optional(),
});

export async function updatePreferencesAction(
  input: z.infer<typeof updatePreferencesSchema>,
): Promise<ActionResult> {
  try {
    await appContext();
    const user = await requireUser();
    const data = updatePreferencesSchema.parse(input);
    await run(`update users set locale = ?, preferred_currency = ?, country = ? where id = ?`, [
      data.locale,
      data.preferred_currency,
      data.country ?? null,
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
