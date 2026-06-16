"use server";

import { currentUser } from "@/server/auth";
import { run } from "@/lib/server/db.server";

const ALLOWED = new Set(["light", "dark", "system"]);

export async function updateThemePrefAction(pref: string): Promise<void> {
  if (!ALLOWED.has(pref)) return;
  const user = await currentUser();
  if (!user) return;
  await run(`update users set theme_pref = ? where id = ?`, [pref, user.id]);
}
