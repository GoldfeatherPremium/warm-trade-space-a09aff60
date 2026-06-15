import type { Metadata } from "next";
import { CreditsClient } from "./credits-client";

export const metadata: Metadata = { title: "Buyer Credits — Admin" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <CreditsClient />;
}
