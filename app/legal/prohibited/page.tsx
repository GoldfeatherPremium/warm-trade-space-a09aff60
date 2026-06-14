import type { Metadata } from "next";
import Link from "next/link";
import { LegalArticle } from "../../_components/legal-article";

export const metadata: Metadata = {
  title: "Prohibited items — X-VAULT",
  description:
    "What sellers may not list on X-VAULT: stolen / carded goods, hacked accounts, unauthorized credentials, and anything violating the underlying service's terms.",
  alternates: { canonical: "/legal/prohibited" },
};

export default function ProhibitedPage() {
  return (
    <LegalArticle
      title="Prohibited items"
      intro="Listings violating this policy are removed on sight and the seller is permanently banned with funds frozen."
    >
      <h2>Hard ban</h2>
      <ul>
        <li>Stolen, carded, or fraudulently obtained gift cards / accounts / codes.</li>
        <li>Hacked accounts or credentials from breached services.</li>
        <li>
          Shared-credential subscriptions or sub-licensing where the underlying ToS forbids resale.
        </li>
        <li>Anything illegal where you or the buyer reside (weapons, drugs, CSAM, etc.).</li>
        <li>Doxxing, harassment kits, swatting services, fake IDs.</li>
      </ul>
      <h2>Restricted (case-by-case)</h2>
      <ul>
        <li>Account boosting and rank-up services for games with anti-cheat clauses.</li>
        <li>Aged social-media accounts (must include original ownership proof).</li>
      </ul>
      <h2>Report a listing</h2>
      <p>
        See something off? Open the listing and tap the report icon, or open a support ticket from{" "}
        <Link href="/contact">Contact</Link>.
      </p>
    </LegalArticle>
  );
}
