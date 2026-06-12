import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Sparkles, X, Send, Loader2, ArrowUpRight } from "lucide-react";
import { aiShoppingAssistant } from "@/lib/api/ai";
import { productImage } from "@/lib/images";
import { usdtShort } from "@/lib/format";
import { toast } from "sonner";

type Pick = {
  slug: string;
  title: string;
  price_cents: number;
  image_key: string | null;
  seller_username: string;
  category_name: string;
  reason: string;
};

type ChatTurn =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; picks?: Pick[] };

const SUGGESTIONS = [
  "Cheap Steam keys under $10",
  "Valorant points top-up",
  "Netflix gift card",
  "Boosting for League of Legends",
];

export function AiShoppingAssistant() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const ask = useMutation({
    mutationFn: (q: string) => aiShoppingAssistant({ data: { query: q } }),
    onSuccess: (res) => {
      setTurns((t) => [
        ...t,
        { role: "assistant", text: res.reply, picks: res.picks as Pick[] },
      ]);
    },
    onError: (e: Error) => {
      toast.error(e.message || "Assistant unavailable");
      setTurns((t) => [
        ...t,
        {
          role: "assistant",
          text: "Sorry — I couldn't reach the assistant. Try again in a moment.",
        },
      ]);
    },
  });

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [turns, ask.isPending]);

  const submit = (text: string) => {
    const v = text.trim();
    if (!v || ask.isPending) return;
    setTurns((t) => [...t, { role: "user", text: v }]);
    setQuery("");
    ask.mutate(v);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40 group inline-flex items-center gap-2 rounded-full px-4 py-3 text-xs font-bold tracking-widest text-primary-foreground shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-shadow"
        style={{ background: "var(--gradient-primary)" }}
        aria-label="Open shopping assistant"
      >
        <Sparkles className="size-4" />
        <span className="hidden sm:inline">ASK AI</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end p-0 sm:p-6">
          <div
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="relative w-full sm:w-[420px] h-[80vh] sm:h-[600px] max-h-[90vh] flex flex-col bg-card border border-border rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div
                  className="size-8 rounded-lg grid place-items-center text-primary-foreground"
                  style={{ background: "var(--gradient-primary)" }}
                >
                  <Sparkles className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-bold leading-tight">Shopping Assistant</p>
                  <p className="text-[10px] text-muted-foreground">
                    AI-powered product search
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="size-8 grid place-items-center rounded-md hover:bg-secondary"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
              {turns.length === 0 && (
                <div className="space-y-3">
                  <p className="text-sm text-foreground/85">
                    Tell me what you're shopping for — I'll match you with the best
                    trusted listings in the marketplace.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => submit(s)}
                        className="text-[11px] px-2.5 py-1.5 rounded-full bg-secondary hover:bg-border text-foreground/85"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {turns.map((t, i) =>
                t.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <div className="bg-primary text-primary-foreground text-xs px-3 py-2 rounded-2xl rounded-br-sm max-w-[85%]">
                      {t.text}
                    </div>
                  </div>
                ) : (
                  <div key={i} className="space-y-2">
                    <div className="text-xs text-foreground/90 bg-secondary/60 rounded-2xl rounded-bl-sm px-3 py-2 max-w-[90%]">
                      {t.text}
                    </div>
                    {t.picks && t.picks.length > 0 && (
                      <div className="space-y-1.5">
                        {t.picks.map((p) => (
                          <Link
                            key={p.slug}
                            to="/p/$slug"
                            params={{ slug: p.slug }}
                            onClick={() => setOpen(false)}
                            className="flex gap-2.5 p-2 rounded-xl bg-background border border-border hover:border-primary/50 transition-colors group"
                          >
                            <div className="size-14 shrink-0 rounded-lg overflow-hidden bg-secondary">
                              <img
                                src={productImage(p.image_key)}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-xs font-bold line-clamp-1">{p.title}</p>
                                <ArrowUpRight className="size-3 text-muted-foreground shrink-0 group-hover:text-primary" />
                              </div>
                              <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">
                                {p.reason}
                              </p>
                              <div className="flex items-center justify-between mt-1">
                                <span className="text-[10px] text-muted-foreground">
                                  @{p.seller_username}
                                </span>
                                <span className="text-[11px] font-mono text-accent">
                                  {usdtShort(p.price_cents)}
                                </span>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ),
              )}

              {ask.isPending && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />
                  Thinking…
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit(query);
              }}
              className="border-t border-border p-3 flex items-center gap-2"
            >
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="What are you looking for?"
                className="flex-1 bg-secondary rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                maxLength={400}
                disabled={ask.isPending}
              />
              <button
                type="submit"
                disabled={!query.trim() || ask.isPending}
                className="size-9 grid place-items-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
                aria-label="Send"
              >
                <Send className="size-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
