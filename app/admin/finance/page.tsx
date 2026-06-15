import type { Metadata } from "next";
import { FinanceClient } from "./finance-client";

export const metadata: Metadata = { title: "Finance — Admin" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <FinanceClient />;
}
