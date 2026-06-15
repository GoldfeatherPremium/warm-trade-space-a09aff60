import type { Metadata } from "next";
import { AdminSellersClient } from "./sellers-client";

export const metadata: Metadata = { title: "Seller Applications — Admin" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <AdminSellersClient />;
}
