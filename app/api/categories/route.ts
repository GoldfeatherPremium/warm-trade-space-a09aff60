import { q } from "@/lib/server/db.server";
import { appContext } from "@/lib/server/app.server";

export const revalidate = 300;

export async function GET() {
  await appContext();
  const cats = await q<{ name: string; slug: string; icon: string }>(
    `select name, slug, icon from categories where is_active = 1 order by sort limit 14`,
  ).catch(() => []);
  return Response.json(cats);
}
