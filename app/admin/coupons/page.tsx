import type { Metadata } from "next";
import { CouponsClient } from "./coupons-client";

export const metadata: Metadata = { title: "Coupons — Admin" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <CouponsClient />;
}
