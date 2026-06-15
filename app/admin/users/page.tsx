import type { Metadata } from "next";
import { AdminUsersClient } from "./users-client";

export const metadata: Metadata = { title: "Users — Admin" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <AdminUsersClient />;
}
