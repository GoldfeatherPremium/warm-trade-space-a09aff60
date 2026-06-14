import { currentUser } from "@/server/auth";

// Lightweight session probe for client islands (header account menu). Kept out
// of the static public-page payload so those pages stay prerendered/edge-cached.
export const dynamic = "force-dynamic";

export async function GET() {
  const u = await currentUser();
  if (!u) return Response.json({ user: null });
  return Response.json({
    user: { id: u.id, username: u.username, role: u.role, seller_status: u.seller_status },
  });
}
