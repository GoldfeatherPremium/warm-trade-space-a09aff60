import type { Metadata } from "next";
import { SettingsClient } from "./settings-client";

export const metadata: Metadata = { title: "Settings — Admin" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <SettingsClient />;
}
