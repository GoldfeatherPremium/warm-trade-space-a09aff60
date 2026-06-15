import type { Metadata } from "next";
import { ItemsClient } from "./items-client";

export const metadata: Metadata = { title: "Selling Items — Admin · X-VAULT" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <ItemsClient />;
}
