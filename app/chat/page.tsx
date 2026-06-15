import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth";
import { listConversations } from "@/server/queries/chat";
import { PublicShell } from "../_components/site-shell";
import { ChatClient } from "./chat-client";

export const metadata: Metadata = { title: "Inbox — X-VAULT", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const user = await requireUser().catch(() => null);
  if (!user) redirect("/auth?redirect=/chat");

  const { c } = await searchParams;
  const conversations = await listConversations(user);

  const initialConversationId =
    c && conversations.some((cv) => cv.id === c) ? c : (conversations[0]?.id ?? null);

  return (
    <PublicShell>
      <ChatClient
        initialConversations={conversations}
        initialConversationId={initialConversationId}
        myId={user.id}
      />
    </PublicShell>
  );
}
