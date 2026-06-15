import type { Metadata } from "next";
import { DisputesClient } from "./disputes-client";

export const metadata: Metadata = { title: "Disputes Center — Admin · X-VAULT" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <DisputesClient />;
}
