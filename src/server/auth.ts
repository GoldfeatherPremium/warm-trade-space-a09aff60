// Next-side session/auth. Self-contained (no import from the TanStack-coupled
// src/lib/server/auth.server.ts) but fully interoperable with it: same
// `sessions` table, same `xv_session` cookie name and token format, so a
// session created on either stack is valid on the other during the migration.
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { q1, run } from "@/lib/server/db.server";
import { now, fail } from "@/lib/server/core.server";

const SESSION_COOKIE = "xv_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

export interface SessionUser {
  id: string;
  email: string;
  username: string;
  role: "buyer" | "seller" | "support" | "finance" | "admin";
  seller_status: "none" | "pending" | "approved" | "suspended" | "rejected";
  seller_level: number;
  rating: number;
  rating_count: number;
  total_sales: number;
  completion_rate: number;
  is_banned: number;
  wallet_frozen: number;
  vacation_mode: number;
  country: string | null;
  locale: string;
  preferred_currency: string;
  created_at: number;
}

/** Create a session row + set the cookie. Call only in Server Actions / route
 * handlers (cookie writes are not allowed during RSC render). */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  await run(`insert into sessions (token, user_id, expires_at, created_at) values (?,?,?,?)`, [
    token,
    userId,
    now() + SESSION_TTL_MS,
    now(),
  ]);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await run(`delete from sessions where token = ?`, [token]);
  store.delete(SESSION_COOKIE);
}

export async function currentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  // Probabilistic expired-session sweep: runs ~1% of requests to keep the
  // sessions table bounded without a dedicated cron job.
  if (Math.random() < 0.01) {
    run(`delete from sessions where expires_at < ?`, [now()]).catch(() => {});
  }

  const row = await q1<SessionUser & { expires_at: number }>(
    `select u.id, u.email, u.username, u.role, u.seller_status, u.seller_level, u.rating,
            u.rating_count, u.total_sales, u.completion_rate, u.is_banned, u.wallet_frozen,
            u.vacation_mode, u.country, u.locale, u.preferred_currency, u.created_at, s.expires_at
     from sessions s join users u on u.id = s.user_id where s.token = ?`,
    [token],
  );
  if (!row) return null;
  if (row.expires_at < now()) {
    await run(`delete from sessions where token = ?`, [token]);
    return null;
  }
  if (row.is_banned) return null;
  const { expires_at: _drop, ...user } = row;
  return user as SessionUser;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) return fail("You must be signed in to do that.") as never;
  return user;
}

export function isStaff(user: SessionUser): boolean {
  return user.role === "admin" || user.role === "support" || user.role === "finance";
}

export async function requireSeller(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.seller_status !== "approved" && !isStaff(user)) fail("Seller account required.");
  return user;
}

export async function requireStaff(roles?: Array<SessionUser["role"]>): Promise<SessionUser> {
  const user = await requireUser();
  const allowed = roles ?? ["support", "finance", "admin"];
  if (user.role !== "admin" && !allowed.includes(user.role))
    fail("You don't have permission to do that.");
  if (!isStaff(user)) fail("You don't have permission to do that.");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") fail("Admin access required.");
  return user;
}
