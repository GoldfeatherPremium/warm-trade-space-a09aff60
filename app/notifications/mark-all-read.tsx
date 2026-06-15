"use client";

import { useRouter } from "next/navigation";
import { markNotificationsReadAction } from "@/server/actions/notifications";

export function MarkAllReadButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await markNotificationsReadAction();
        router.refresh();
      }}
      className="text-xs text-muted-foreground hover:text-foreground"
    >
      Mark all read
    </button>
  );
}
