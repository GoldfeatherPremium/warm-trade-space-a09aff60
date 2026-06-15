import type { Metadata } from "next";
import { PaymentsClient } from "./payments-client";

export const metadata: Metadata = { title: "Payment Methods — Admin" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <PaymentsClient />;
}
