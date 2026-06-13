import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";

export const Route = createFileRoute("/legal/prohibited")({
  head: () => ({
    meta: [
      { title: "Prohibited items — X-VAULT" },
      {
        name: "description",
        content:
          "What sellers may not list on X-VAULT: stolen / carded goods, hacked accounts, unauthorized credentials, and anything violating the underlying service's terms.",
      },
    ],
  }),
  component: () => (
    <LegalPage title="Prohibited items" intro="Listings violating this policy are removed on sight and the seller is permanently banned with funds frozen.">
      <h2>Hard ban</h2>
      <ul>
        <li>Stolen, carded, or fraudulently obtained gift cards / accounts / codes.</li>
        <li>Hacked accounts or credentials from breached services.</li>
        <li>Shared-credential subscriptions or sub-licensing where the underlying ToS forbids resale.</li>
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
        <a className="underline" href="/contact">Contact</a>.
      </p>
    </LegalPage>
  ),
});
