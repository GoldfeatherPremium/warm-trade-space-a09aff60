"use server";

import { z } from "zod";
import { q1, run } from "@/lib/server/db.server";
import { appContext } from "@/lib/server/app.server";
import { audit, hashPassword, now, uid, verifyPassword } from "@/lib/server/core.server";
import { rateLimit } from "@/lib/server/rate-limit.server";
import { createSession, destroySession } from "../auth";

export type ActionResult = { ok: true } | { ok: false; error: string };

const registerSchema = z.object({
  email: z.string().email().max(120),
  username: z
    .string()
    .min(3)
    .max(24)
    .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers and underscore only"),
  password: z.string().min(8).max(100),
  refCode: z.string().trim().min(3).max(16).optional(),
});

export async function registerAction(input: z.infer<typeof registerSchema>): Promise<ActionResult> {
  try {
    await appContext();
    const data = registerSchema.parse(input);
    const email = data.email.toLowerCase().trim();
    rateLimit({ key: `register:${email}`, limit: 5, windowMs: 60_000 });
    if (await q1(`select 1 as x from users where email = ?`, [email]))
      return { ok: false, error: "An account with that email already exists." };
    if (await q1(`select 1 as x from users where lower(username) = lower(?)`, [data.username]))
      return { ok: false, error: "That username is taken." };
    const id = uid();
    await run(
      `insert into users (id, email, username, password_hash, role, created_at) values (?,?,?,?, 'buyer', ?)`,
      [id, email, data.username, hashPassword(data.password), now()],
    );
    await run(`insert into wallets (user_id) values (?)`, [id]);
    await createSession(id);
    await audit(id, "user.register", "user", id);
    if (data.refCode) {
      try {
        const ref = await q1<{ id: string; owner_user_id: string }>(
          `select id, owner_user_id from referrals where code = ?`,
          [data.refCode.toUpperCase()],
        );
        if (ref && ref.owner_user_id !== id) {
          await run(
            `insert into referral_attributions (user_id, referral_id, attributed_at) values (?,?,?)`,
            [id, ref.id, now()],
          );
          await run(`update referrals set signup_count = signup_count + 1 where id = ?`, [ref.id]);
        }
      } catch (e) {
        console.error("[referral] attribution failed", (e as Error)?.message);
      }
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error)?.message ?? "Registration failed." };
  }
}

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function loginAction(input: z.infer<typeof loginSchema>): Promise<ActionResult> {
  try {
    await appContext();
    const data = loginSchema.parse(input);
    const email = data.email.toLowerCase().trim();
    rateLimit({ key: `login:${email}`, limit: 8, windowMs: 60_000 });
    const row = await q1<{ id: string; password_hash: string; is_banned: number }>(
      `select id, password_hash, is_banned from users where email = ?`,
      [email],
    );
    if (!row || !verifyPassword(data.password, row.password_hash))
      return { ok: false, error: "Invalid email or password." };
    if (row.is_banned)
      return { ok: false, error: "This account has been banned. Contact support." };
    await createSession(row.id);
    await audit(row.id, "user.login", "user", row.id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error)?.message ?? "Login failed." };
  }
}

export async function logoutAction(): Promise<ActionResult> {
  try {
    await appContext();
    await destroySession();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error)?.message ?? "Logout failed." };
  }
}
