import type { Metadata } from "next";
import { VerificationsClient } from "./verifications-client";

export const metadata: Metadata = { title: "Verifications — Admin" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <VerificationsClient />;
}
