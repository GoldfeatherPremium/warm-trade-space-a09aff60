"use client";

import { useState } from "react";
import { addDisputeEvidenceAction, postDisputeMessageAction } from "@/server/actions/disputes";
import { dateTime } from "@/lib/format";

type Evidence = {
  id: string;
  author_role: string;
  kind: string;
  title: string;
  body: string | null;
  url: string | null;
  created_at: number;
  author_name: string;
};

type DisputeMessage = {
  id: string;
  author_role: string;
  body: string;
  is_internal: number;
  created_at: number;
  author_name: string;
};

export function DisputeClient({
  orderId,
  myRole,
  evidenceInit,
  messagesInit,
  resolved,
}: {
  orderId: string;
  myRole: "buyer" | "seller" | "staff";
  evidenceInit: Evidence[];
  messagesInit: DisputeMessage[];
  resolved: boolean;
}) {
  const [evidence, setEvidence] = useState(evidenceInit);
  const [messages, setMessages] = useState(messagesInit);
  const [tab, setTab] = useState<"messages" | "evidence">("messages");

  // Message form
  const [msgBody, setMsgBody] = useState("");
  const [msgBusy, setMsgBusy] = useState(false);
  const [msgError, setMsgError] = useState<string | null>(null);

  // Evidence form
  const [evOpen, setEvOpen] = useState(false);
  const [evKind, setEvKind] = useState<
    "screenshot" | "log" | "delivery_proof" | "chat_excerpt" | "other"
  >("screenshot");
  const [evTitle, setEvTitle] = useState("");
  const [evBody, setEvBody] = useState("");
  const [evUrl, setEvUrl] = useState("");
  const [evBusy, setEvBusy] = useState(false);
  const [evError, setEvError] = useState<string | null>(null);

  const inputCls =
    "w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50";
  const ROLE_CLS: Record<string, string> = {
    buyer: "bg-accent/10 text-accent",
    seller: "bg-accent/10 text-accent",
    staff: "bg-primary/10 text-primary",
  };

  async function sendMessage() {
    if (!msgBody.trim() || msgBusy) return;
    setMsgBusy(true);
    setMsgError(null);
    const res = await postDisputeMessageAction({ orderId, body: msgBody.trim() });
    setMsgBusy(false);
    if (!res.ok) {
      setMsgError(res.error);
      return;
    }
    setMsgBody("");
    // optimistic add
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        author_role: myRole,
        body: msgBody.trim(),
        is_internal: 0,
        created_at: Date.now(),
        author_name: "You",
      },
    ]);
  }

  async function addEvidence() {
    if (!evTitle.trim() || evBusy) return;
    setEvBusy(true);
    setEvError(null);
    const res = await addDisputeEvidenceAction({
      orderId,
      kind: evKind,
      title: evTitle,
      body: evBody || undefined,
      url: evUrl || undefined,
    });
    setEvBusy(false);
    if (!res.ok) {
      setEvError(res.error);
      return;
    }
    setEvTitle("");
    setEvBody("");
    setEvUrl("");
    setEvOpen(false);
    setEvidence((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        author_role: myRole,
        kind: evKind,
        title: evTitle,
        body: evBody || null,
        url: evUrl || null,
        created_at: Date.now(),
        author_name: "You",
      },
    ]);
  }

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 bg-secondary rounded-lg p-1 w-fit">
        {(["messages", "evidence"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${tab === t ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {tab === "messages" && (
        <div className="space-y-3">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No messages yet.</p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className="bg-card border border-border rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${ROLE_CLS[m.author_role] ?? "bg-muted"}`}
                  >
                    {m.author_role.toUpperCase()}
                  </span>
                  <span className="text-xs font-bold">{m.author_name}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {dateTime(m.created_at)}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{m.body}</p>
              </div>
            ))
          )}

          {!resolved && (
            <div className="space-y-2">
              {msgError && <p className="text-xs text-destructive">{msgError}</p>}
              <textarea
                value={msgBody}
                onChange={(e) => setMsgBody(e.target.value)}
                rows={3}
                placeholder="Add a message to the dispute…"
                className={inputCls}
              />
              <button
                onClick={sendMessage}
                disabled={msgBusy || !msgBody.trim()}
                className="px-4 py-2 text-sm font-bold bg-primary text-primary-foreground rounded-md disabled:opacity-60"
              >
                {msgBusy ? "Sending…" : "Send message"}
              </button>
            </div>
          )}
        </div>
      )}

      {tab === "evidence" && (
        <div className="space-y-3">
          {evidence.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No evidence submitted yet.</p>
          ) : (
            evidence.map((e) => (
              <div key={e.id} className="bg-card border border-border rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${ROLE_CLS[e.author_role] ?? "bg-muted"}`}
                  >
                    {e.author_role.toUpperCase()}
                  </span>
                  <span className="text-[10px] font-bold text-muted-foreground">
                    {e.kind.replaceAll("_", " ").toUpperCase()}
                  </span>
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {dateTime(e.created_at)}
                  </span>
                </div>
                <p className="text-xs font-bold">{e.title}</p>
                {e.body && <p className="text-xs text-muted-foreground">{e.body}</p>}
                {e.url && (
                  <a
                    href={e.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary hover:underline break-all"
                  >
                    {e.url}
                  </a>
                )}
              </div>
            ))
          )}

          {!resolved &&
            (evOpen ? (
              <div className="border border-border rounded-lg p-3 space-y-2">
                <p className="text-xs font-bold">Add evidence</p>
                {evError && <p className="text-xs text-destructive">{evError}</p>}
                <select
                  value={evKind}
                  onChange={(e) => setEvKind(e.target.value as never)}
                  className={inputCls}
                >
                  <option value="screenshot">Screenshot</option>
                  <option value="delivery_proof">Delivery proof</option>
                  <option value="chat_excerpt">Chat excerpt</option>
                  <option value="log">Log / transaction</option>
                  <option value="other">Other</option>
                </select>
                <input
                  value={evTitle}
                  onChange={(e) => setEvTitle(e.target.value)}
                  placeholder="Title (required)"
                  className={inputCls}
                />
                <textarea
                  value={evBody}
                  onChange={(e) => setEvBody(e.target.value)}
                  rows={2}
                  placeholder="Description (optional)"
                  className={inputCls}
                />
                <input
                  value={evUrl}
                  onChange={(e) => setEvUrl(e.target.value)}
                  placeholder="URL (optional)"
                  className={inputCls}
                />
                <div className="flex gap-2">
                  <button
                    onClick={addEvidence}
                    disabled={evBusy || !evTitle.trim()}
                    className="px-4 py-2 text-xs font-bold bg-primary text-primary-foreground rounded-md disabled:opacity-60"
                  >
                    {evBusy ? "Submitting…" : "Submit evidence"}
                  </button>
                  <button
                    onClick={() => setEvOpen(false)}
                    className="px-4 py-2 text-xs text-muted-foreground"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setEvOpen(true)}
                className="text-xs text-primary hover:underline"
              >
                + Add evidence
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
