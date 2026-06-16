"use server";

import { run } from "@/lib/server/db.server";
import { appContext } from "@/lib/server/app.server";
import { now } from "@/lib/server/core.server";
import { requireUser } from "../auth";

export async function markNotificationsReadAction(ids?: string[]): Promise<void> {
  await appContext();
  const user = await requireUser();
  if (ids?.length) {
    // Batch all IDs into a single UPDATE instead of N sequential queries.
    const placeholders = ids.map(() => "?").join(",");
    await run(
      `update notifications set read_at = ? where user_id = ? and id in (${placeholders})`,
      [now(), user.id, ...ids],
    );
  } else {
    await run(`update notifications set read_at = ? where user_id = ? and read_at is null`, [
      now(),
      user.id,
    ]);
  }
}
