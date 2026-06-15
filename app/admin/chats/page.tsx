import type { Metadata } from "next";
import { ChatsClient } from "./chats-client";

export const metadata: Metadata = { title: "Chat Monitor — Admin" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <ChatsClient />;
}
