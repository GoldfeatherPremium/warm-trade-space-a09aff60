import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About X-VAULT — Escrow-protected digital marketplace" },
      {
        name: "description",
        content:
          "X-VAULT is an escrow-protected marketplace for digital goods. Learn how we protect buyers and sellers with on-platform chat, instant delivery, and a 24/7 dispute team.",
      },
    ],
  }),
  component: () => (
    <LegalPage
      title="About X-VAULT"
      intro="X-VAULT is a trust-first marketplace for digital goods — game accounts, subscriptions, gift cards, in-game currency and more — built around escrow, on-platform chat, and a dispute team that takes evidence seriously."
    >
      <h2>What we do</h2>
      <p>
        Buyers pay into escrow. Sellers deliver. Funds release only when delivery passes the warranty window
        and the buyer confirms. Every step is logged so disputes resolve on facts, not opinions.
      </p>
      <h2>What makes us different</h2>
      <ul>
        <li>Escrow-protected payments — sellers cannot run away with funds.</li>
        <li>All chat stays on-platform and is monitored for personal-info and fraud attempts.</li>
        <li>Stock encrypted at rest; staff cannot read credentials in the clear without an audit trail.</li>
        <li>Refunds default to instant store credit so buyers can keep shopping immediately.</li>
      </ul>
    </LegalPage>
  ),
});
