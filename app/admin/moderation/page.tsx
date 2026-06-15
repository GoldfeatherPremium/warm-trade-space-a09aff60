import type { Metadata } from "next";
import { ModerationClient } from "./moderation-client";

export const metadata: Metadata = { title: "Chat Moderation — Admin" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <ModerationClient />;
}
