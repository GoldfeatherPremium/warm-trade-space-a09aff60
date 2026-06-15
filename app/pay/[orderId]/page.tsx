import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PublicShell } from "../../_components/site-shell";
import { requireUser } from "@/server/auth";
import { getPaymentData } from "@/server/queries/orders";
import { getWallet, getBuyerCredits } from "@/lib/server/money.server";
import { PayClient } from "./pay-client";

export const metadata: Metadata = { title: "Pay with USDT", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PayPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const user = await requireUser().catch(() => null);
  if (!user) redirect(`/auth?redirect=/pay/${orderId}`);

  const [payData, wallet, credits] = await Promise.all([
    getPaymentData(orderId, user),
    getWallet(user.id).catch(() => ({ available_cents: 0 })),
    getBuyerCredits(user.id).catch(() => ({ balance_cents: 0 })),
  ]);
  if (!payData) notFound();

  // If already paid/processing, go to order detail
  if (!["awaiting_payment", "expired"].includes(payData.order.status)) {
    redirect(`/orders/${orderId}`);
  }

  const initial = {
    ...payData,
    walletAvailable: wallet.available_cents,
    creditsAvailable: credits.balance_cents,
  };

  return (
    <PublicShell>
      <PayClient initial={initial} orderId={orderId} />
    </PublicShell>
  );
}
