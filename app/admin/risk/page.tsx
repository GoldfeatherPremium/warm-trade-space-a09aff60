import type { Metadata } from "next";
import { RiskClient } from "./risk-client";

export const metadata: Metadata = { title: "Risk & Fraud — Admin · X-VAULT" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <RiskClient />;
}
