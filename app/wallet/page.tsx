import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth";
import { getWalletData } from "@/server/queries/wallet";
import { PublicShell } from "../_components/site-shell";
import { WalletClient } from "./wallet-client";

export const metadata: Metadata = { title: "Wallet — X-VAULT" };
export const dynamic = "force-dynamic";

export default async function WalletPage() {
  const user = await requireUser().catch(() => null);
  if (!user) redirect("/auth?redirect=/wallet");

  const data = await getWalletData(user);

  return (
    <PublicShell>
      <h1 className="font-display text-3xl mb-6">WALLET</h1>
      <div className="max-w-3xl">
        <WalletClient initial={data} />
      </div>
    </PublicShell>
  );
}
