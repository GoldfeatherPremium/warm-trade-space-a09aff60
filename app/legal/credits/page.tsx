import type { Metadata } from "next";
import Link from "next/link";
import { LegalArticle } from "../../_components/legal-article";

export const metadata: Metadata = {
  title: "Credits & refunds",
  description:
    "How X-VAULT store credit works: refunds default to instant credit, credits apply automatically at checkout, and cash withdrawals are available on request.",
  alternates: { canonical: "/legal/credits" },
};

export default function CreditsPage() {
  return (
    <LegalArticle
      title="Credits & refunds"
      intro="Refunds in seconds — credits keep you shopping without waiting for the blockchain."
    >
      <h2>Why credits-first</h2>
      <p>
        Crypto refunds can take 5–30 minutes and cost network fees. Store credit refunds are
        instant, free, and spendable immediately.
      </p>
      <h2>Earning credit</h2>
      <ul>
        <li>Refunds from disputes / replacements.</li>
        <li>Promotional credit from campaigns and seasonal events.</li>
        <li>Loyalty rewards as you level up.</li>
      </ul>
      <h2>Using credit at checkout</h2>
      <p>
        Checkout always shows your available credit and applies it first. Only the remainder is
        charged to USDT (or other method). Partial use is allowed.
      </p>
      <h2>Withdrawing credit to USDT</h2>
      <p>
        Open <Link href="/wallet">Wallet</Link> and request a withdrawal. A small processing fee
        applies and the request is reviewed by finance staff before payout.
      </p>
    </LegalArticle>
  );
}
