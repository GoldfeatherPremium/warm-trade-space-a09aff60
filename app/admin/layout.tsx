import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth";
import { AdminShell } from "./_components/admin-shell";

export const metadata: Metadata = {
  title: "Admin Control Center",
  robots: { index: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/auth?redirect=/admin");
  const allowed = user.role === "admin" || user.role === "support" || user.role === "finance";
  if (!allowed) redirect("/dashboard");
  return <AdminShell>{children}</AdminShell>;
}
