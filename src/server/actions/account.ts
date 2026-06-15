"use server";

import { z } from "zod";
import { q1, run } from "@/lib/server/db.server";
import { appContext } from "@/lib/server/app.server";
import { now } from "@/lib/server/core.server";
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
    const { createHash } = await import("node:crypto");
    const hash = (p: string) => createHash("sha256").update(p).digest("hex");

    if (input.newPassword) {
      if (!input.currentPassword) return { ok: false, error: "Current password required." };
      const row = await q1<{ password_hash: string }>(
        `select password_hash from users where id = ?`,
        [user.id],
      );
      if (!row || row.password_hash !== hash(input.currentPassword))
        return { ok: false, error: "Current password is incorrect." };
      await run(`update users set password_hash = ?, updated_at = ? where id = ?`, [
        hash(input.newPassword),
        now(),
        user.id,
      ]);
    }

    if (input.username && input.username !== user.username) {
      const taken = await q1(
        `select 1 as x from users where lower(username) = lower(?) and id != ?`,
        [input.username, user.id],
      );
      if (taken) return { ok: false, error: "Username already taken." };
      await run(`update users set username = ?, updated_at = ? where id = ?`, [
        input.username,
        now(),
        user.id,
      ]);
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
    await run(
      `update users set locale = ?, preferred_currency = ?, country = ?, updated_at = ? where id = ?`,
      [input.locale, input.preferred_currency, input.country || null, now(), user.id],
    );
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
