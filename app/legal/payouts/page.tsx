import type { Metadata } from "next";
import { LegalArticle } from "../../_components/legal-article";

export const metadata: Metadata = {
  title: "Payouts & withdrawals — X-VAULT",
  description:
    "How seller payouts work on X-VAULT: USDT networks supported, minimum withdrawal, finance review window, and how holds get released.",
  alternates: { canonical: "/legal/payouts" },
};

export default function PayoutsPage() {
  return (
    <LegalArticle title="Payouts & withdrawals" intro="When and how sellers get paid.">
      <h2>From escrow to available</h2>
      <p>
        After warranty expires (or the buyer confirms early), the seller's net amount moves from
        pending escrow into available balance on the wallet.
      </p>
      <h2>Withdrawing</h2>
      <ul>
        <li>Networks: TRC-20, BEP-20, ERC-20 USDT.</li>
        <li>Minimum withdrawal and network fee shown on the Wallet page.</li>
        <li>Finance staff review withdrawals before broadcast — typically within hours.</li>
      </ul>
      <h2>Holds &amp; freezes</h2>
      <p>
        New / unverified sellers may have a short hold on first payouts as anti-fraud. Disputed
        orders freeze the corresponding amount until resolved.
      </p>
    </LegalArticle>
  );
}
