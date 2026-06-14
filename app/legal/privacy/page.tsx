import type { Metadata } from "next";
import { LegalArticle } from "../../_components/legal-article";

export const metadata: Metadata = {
  title: "Privacy Policy — X-VAULT",
  description:
    "What X-VAULT collects, why, and how long we keep it. Chat monitoring, encrypted stock-at-rest, and your rights as a buyer or seller.",
  alternates: { canonical: "/legal/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalArticle
      title="Privacy Policy"
      intro="We collect what we need to run an escrow marketplace safely — nothing more."
    >
      <h2>What we collect</h2>
      <ul>
        <li>Account: email, username, password hash, login IP &amp; user-agent.</li>
        <li>Trades: orders, payments, payouts, withdrawals, ledger entries.</li>
        <li>Chat: every message between buyers, sellers and staff. Monitored for fraud and PII.</li>
        <li>
          Verification: legal name, country, ID reference (only when applying for a verified tier).
        </li>
      </ul>
      <h2>Encryption at rest</h2>
      <p>
        Stock data (credentials, codes, keys) is AES-256-GCM encrypted at rest. Staff cannot read it
        without leaving an audit trail.
      </p>
      <h2>Chat monitoring</h2>
      <p>
        All conversations are logged and may be reviewed by trust &amp; safety staff to enforce
        these terms. By using X-VAULT chat you consent to this monitoring.
      </p>
      <h2>Retention</h2>
      <p>
        Orders, payouts and audit logs are kept for the period required by financial regulations.
        Closed accounts have profile data anonymized; transactional records remain.
      </p>
      <h2>Your rights</h2>
      <p>Contact support for data access or deletion requests.</p>
    </LegalArticle>
  );
}
