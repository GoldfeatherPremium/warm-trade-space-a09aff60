import type { Metadata } from "next";
import { requireUser } from "@/server/auth";
import { PublicShell } from "../_components/site-shell";
import { MenuClient } from "./menu-client";

export const metadata: Metadata = { title: "My Account — X-VAULT" };
export const dynamic = "force-dynamic";

export default async function MenuPage() {
  const user = await requireUser().catch(() => null);

  return (
    <PublicShell>
      <MenuClient
        user={
          user
            ? {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                seller_status: user.seller_status,
                seller_level: user.seller_level,
              }
            : null
        }
      />
    </PublicShell>
  );
}
