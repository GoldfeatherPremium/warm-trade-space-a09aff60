import type { Metadata } from "next";
import { VerificationsClient } from "./verifications-client";

export const metadata: Metadata = { title: "Verifications — Admin · X-VAULT" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <VerificationsClient />;
}
