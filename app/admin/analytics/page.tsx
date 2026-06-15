import type { Metadata } from "next";
import { AnalyticsClient } from "./analytics-client";

export const metadata: Metadata = { title: "Marketplace Analytics — Admin · X-VAULT" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <AnalyticsClient />;
}
