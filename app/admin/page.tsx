import type { Metadata } from "next";
import { AdminDashboardClient } from "./dashboard-client";

export const metadata: Metadata = { title: "Admin Dashboard" };
export const dynamic = "force-dynamic";

export default function AdminDashboardPage() {
  return <AdminDashboardClient />;
}
