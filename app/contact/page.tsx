import type { Metadata } from "next";
import Link from "next/link";
import { LegalArticle } from "../_components/legal-article";

export const metadata: Metadata = {
  title: "Contact & support",
  description:
    "Get help from the X-VAULT trust & safety team. Open a dispute, report a listing, or reach support — fastest response inside the order or dispute thread.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <LegalArticle
      title="Contact & support"
      intro="The fastest path to a human is from inside the order or dispute thread — that's where staff can see the full context."
    >
      <h2>Order / dispute issues</h2>
      <p>
        Open the order, click <b>&ldquo;Open dispute&rdquo;</b>, and describe the issue. A staff
        agent picks it up within the dispute SLA. Attach screenshots or video of what was delivered
        vs. what was promised.
      </p>
      <h2>Account / trust issues</h2>
      <p>
        For account lockouts, ID verification questions or reporting a seller, use the in-app{" "}
        <Link href="/chat">support chat</Link>.
      </p>
      <h2>Press &amp; partnerships</h2>
      <p>
        Reach out through the in-app support thread and pick the &ldquo;Partnerships&rdquo;
        category.
      </p>
    </LegalArticle>
  );
}
