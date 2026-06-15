import type { Metadata } from "next";
import Link from "next/link";
import { LegalArticle } from "../../_components/legal-article";

export const metadata: Metadata = {
  title: "Buyer protection",
  description:
    "X-VAULT buyer protection: warranty windows, refund-to-credit, insurance days, and what to do when delivery is wrong or missing.",
  alternates: { canonical: "/legal/buyer-protection" },
};

export default function BuyerProtectionPage() {
  return (
    <LegalArticle
      title="Buyer protection"
      intro="What you're entitled to as a buyer — and how to use it."
    >
      <h2>Warranty window</h2>
      <p>
        Every listing has a warranty window. If credentials stop working or delivery is wrong, open
        a dispute inside that window for a full refund.
      </p>
      <h2>Insurance days</h2>
      <p>
        Premium listings include extra insurance days beyond warranty. We cover replacement or
        refund within that period even if the seller is unresponsive.
      </p>
      <h2>Refund-to-credit</h2>
      <p>
        Refunds default to instant <Link href="/legal/credits">store credit</Link> so you can keep
        shopping without waiting for the network. You can withdraw credit to your original payment
        method at any time.
      </p>
      <h2>What to do when something is wrong</h2>
      <ul>
        <li>Stay calm — open the order page.</li>
        <li>Click &ldquo;Open dispute&rdquo; and describe the issue in one paragraph.</li>
        <li>Upload screenshots or short video of the problem.</li>
        <li>Do NOT contact the seller off-platform — it breaks protection.</li>
      </ul>
    </LegalArticle>
  );
}
