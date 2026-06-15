import type { Metadata } from "next";
import { SettingsClient } from "./settings-client";

export const metadata: Metadata = { title: "Settings — Admin · X-VAULT" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <SettingsClient />;
}
