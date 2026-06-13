import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";

export const Route = createFileRoute("/legal/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — X-VAULT" },
      {
        name: "description",
        content:
          "X-VAULT Terms of Service: account rules, prohibited items, escrow flow, dispute resolution, and the consequences of off-platform contact or fee circumvention.",
      },
    ],
  }),
  component: () => (
    <LegalPage title="Terms of Service" intro="Using X-VAULT means you agree to these terms. We keep them short and direct.">
      <h2>1. Eligibility</h2>
      <p>You must be 18+ and legally allowed to transact in your jurisdiction.</p>
      <h2>2. On-platform only</h2>
      <p>
        All chat, payments, and delivery happen on X-VAULT. Sharing personal contact info
        (phone, email, Telegram, Discord, WhatsApp, payment links, wallet addresses) or moving the deal
        off-platform is grounds for immediate ban and forfeiture of escrow.
      </p>
      <h2>3. Prohibited items</h2>
      <p>See the <a className="underline" href="/legal/prohibited">prohibited items policy</a>. Listings that violate it are removed and sellers banned.</p>
      <h2>4. Escrow &amp; refunds</h2>
      <p>
        Buyer funds are held in escrow until delivery is confirmed or the warranty window passes.
        Refunds are issued as <a className="underline" href="/legal/credits">store credit</a> by default;
        cash-back to the original method is available on request and subject to a small processing fee.
      </p>
      <h2>5. Disputes</h2>
      <p>
        Either party may open a dispute from the order page. Staff review snapshots, chat logs, and
        delivery proof and rule within the dispute SLA. Decisions are final.
      </p>
      <h2>6. Account termination</h2>
      <p>
        We may suspend or terminate accounts for fraud, off-platform contact, repeated disputes,
        prohibited listings, or attempts to circumvent fees.
      </p>
    </LegalPage>
  ),
});
