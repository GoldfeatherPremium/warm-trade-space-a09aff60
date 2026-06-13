import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact & support — X-VAULT" },
      {
        name: "description",
        content:
          "Get help from the X-VAULT trust & safety team. Open a dispute, report a listing, or reach support — fastest response inside the order or dispute thread.",
      },
    ],
  }),
  component: () => (
    <LegalPage
      title="Contact & support"
      intro="The fastest path to a human is from inside the order or dispute thread — that's where staff can see the full context."
    >
      <h2>Order / dispute issues</h2>
      <p>
        Open the order, click <b>"Open dispute"</b>, and describe the issue. A staff agent picks it up within
        the dispute SLA. Attach screenshots or video of what was delivered vs. what was promised.
      </p>
      <h2>Account / trust issues</h2>
      <p>
        For account lockouts, ID verification questions or reporting a seller, use the in-app{" "}
        <a href="/chat" className="underline">support chat</a>.
      </p>
      <h2>Press &amp; partnerships</h2>
      <p>Reach out through the in-app support thread and pick the "Partnerships" category.</p>
    </LegalPage>
  ),
});
