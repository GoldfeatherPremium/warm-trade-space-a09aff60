import type { Metadata } from "next";
import { AuditClient } from "./audit-client";

export const metadata: Metadata = { title: "Audit Log — Admin · X-VAULT" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <AuditClient />;
}
