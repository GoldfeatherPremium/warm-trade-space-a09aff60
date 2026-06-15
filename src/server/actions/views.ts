"use server";

import { run } from "@/lib/server/db.server";

export async function recordProductViewAction(productId: string) {
  await run(`update products set views = views + 1 where id = ?`, [productId]);
}
