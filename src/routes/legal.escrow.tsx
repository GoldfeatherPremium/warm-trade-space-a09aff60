import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";

export const Route = createFileRoute("/legal/escrow")({
  head: () => ({
    meta: [
      { title: "How escrow works — X-VAULT" },
      {
        name: "description",
        content:
          "Step-by-step: how X-VAULT escrow protects buyers and sellers from payment to release, with warranty windows and dispute fallback.",
      },
    ],
  }),
  component: () => (
    <LegalPage
      title="How escrow works"
      intro="Money sits with X-VAULT — not the seller — until delivery passes warranty."
    >
      <h2>1. Buyer pays</h2>
      <p>Funds (USDT or store credit) land in escrow the moment payment is confirmed.</p>
      <h2>2. Seller delivers</h2>
      <p>
        Auto-delivery products release stock instantly. Manual products are delivered through the
        order chat.
      </p>
      <h2>3. Warranty window</h2>
      <p>
        Buyer has the warranty period (set per listing) to confirm delivery or report an issue.
        After it elapses without a dispute, escrow auto-releases to the seller.
      </p>
      <h2>4. Dispute fallback</h2>
      <p>
        Either party can open a dispute. Funds stay frozen until staff rule based on the order
        snapshot, chat log and uploaded proof.
      </p>
      <h2>5. Payout</h2>
      <p>
        Released escrow becomes available wallet balance. Sellers withdraw to USDT after a small
        network fee.
      </p>
    </LegalPage>
  ),
});
