import type { Metadata } from "next";
import { LegalArticle } from "../../_components/legal-article";

export const metadata: Metadata = {
  title: "Fees & commissions",
  description:
    "X-VAULT fee schedule: 8% base commission, per-category overrides, USDT withdrawal fees, and what buyers pay at checkout.",
  alternates: { canonical: "/legal/fees" },
};

export default function FeesPage() {
  return (
    <LegalArticle title="Fees & commissions" intro="Transparent pricing — no hidden buyer fees.">
      <h2>Sellers</h2>
      <ul>
        <li>
          Base commission: <b>8%</b> of order total.
        </li>
        <li>
          Higher-risk categories may carry a different commission — shown on the listing form.
        </li>
        <li>
          USDT withdrawal: small network/processing fee per payout (shown before you confirm).
        </li>
      </ul>
      <h2>Buyers</h2>
      <ul>
        <li>No buyer-side fees at checkout — the listed price is what you pay.</li>
        <li>
          Refunds to store credit are free; cash-back to original payment has a processing fee.
        </li>
      </ul>
      <h2>Configurability</h2>
      <p>Commission percentages are configurable per category and may be updated over time.</p>
    </LegalArticle>
  );
}
