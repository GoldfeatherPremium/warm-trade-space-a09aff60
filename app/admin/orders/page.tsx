import type { Metadata } from "next";
import { OrdersClient } from "./orders-client";

export const metadata: Metadata = { title: "All Orders — Admin" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <OrdersClient />;
}
