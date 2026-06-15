import type { Metadata } from "next";
import { OrdersClient } from "./orders-client";

export const metadata: Metadata = { title: "All Orders — Admin · X-VAULT" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <OrdersClient />;
}
