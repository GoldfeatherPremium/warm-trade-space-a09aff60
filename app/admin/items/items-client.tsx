"use client";

import { useEffect, useState, useTransition } from "react";
import {
  adminListItemsAction,
  adminSaveItemAction,
  reviewItemSuggestionAction,
} from "@/server/actions/admin";
import { dateTime } from "@/lib/format";

type ItemsData = Awaited<ReturnType<typeof adminListItemsAction>>;
type Item = ItemsData["items"][number];
type Suggestion = ItemsData["suggestions"][number];
type Category = ItemsData["categories"][number];

const EMPTY = {
  itemId: undefined as string | undefined,
  name: "",
  isActive: true,
  categoryIds: [] as string[],
};

const BTN = "px-3 py-1.5 rounded-md text-xs font-bold disabled:opacity-50";
const INPUT =
  "bg-secondary border border-border rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50";

export function ItemsClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function load() {
    startTransition(async () => {
      try {
        const data = await adminListItemsAction();
        setItems(data.items);
        setSuggestions(data.suggestions as Suggestion[]);
        setCategories(data.categories);
      } finally {
        setLoading(false);
      }
    });
  }

  useEffect(() => {
    load();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await adminSaveItemAction(form);
      setMsg("Item saved.");
      setForm(EMPTY);
      load();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function reviewSuggestion(suggestionId: string, approve: boolean) {
    setSaving(true);
    try {
      await reviewItemSuggestionAction({ suggestionId, approve });
      load();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? "?";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl">SELLING ITEMS</h1>
        <p className="text-[11px] text-muted-foreground">
          Games, brands and services sellers can list under.
        </p>
      </div>

      {msg && (
        <p className="text-xs bg-secondary border border-border rounded-md px-3 py-2">{msg}</p>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-bold tracking-widest text-warning">SELLER REQUESTS</h2>
          {suggestions.map((s) => (
            <div
              key={s.id as string}
              className="bg-card border border-border rounded-lg p-3 flex items-center gap-3 text-xs flex-wrap"
            >
              <span className="font-bold">{s.name as string}</span>
              <span className="text-[10px] text-muted-foreground">
                by {s.username as string} · {dateTime(s.created_at as number)}
                {s.note ? ` · "${s.note}"` : ""}
              </span>
              <span
                className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                  s.status === "pending"
                    ? "bg-warning/15 text-warning"
                    : s.status === "approved"
                      ? "bg-accent/15 text-accent"
                      : "bg-destructive/15 text-destructive"
                }`}
              >
                {(s.status as string).toUpperCase()}
              </span>
              {s.status === "pending" && (
                <span className="ml-auto flex gap-1.5">
                  <button
                    className={`${BTN} bg-primary text-primary-foreground`}
                    disabled={saving}
                    onClick={() => reviewSuggestion(s.id as string, true)}
                  >
                    Approve & add
                  </button>
                  <button
                    className={`${BTN} bg-destructive text-destructive-foreground`}
                    disabled={saving}
                    onClick={() => reviewSuggestion(s.id as string, false)}
                  >
                    Reject
                  </button>
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-2">
          {items.map((i) => (
            <div
              key={i.id}
              className="bg-card border border-border rounded-lg p-3 flex items-center gap-3 text-xs flex-wrap"
            >
              <span className="font-bold">{i.name}</span>
              {!i.is_active && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-muted">DISABLED</span>
              )}
              <span className="text-[10px] text-muted-foreground flex-1">
                {i.categoryIds.length === 0
                  ? "all sub-categories"
                  : i.categoryIds.map(catName).join(" · ")}
              </span>
              <button
                className={`${BTN} bg-secondary text-foreground`}
                onClick={() =>
                  setForm({
                    itemId: i.id,
                    name: i.name,
                    isActive: !!i.is_active,
                    categoryIds: i.categoryIds,
                  })
                }
              >
                Edit
              </button>
            </div>
          ))}
        </div>
      )}

      <form
        className="bg-card border border-border rounded-lg p-4 space-y-3 max-w-xl"
        onSubmit={save}
      >
        <h2 className="text-xs font-bold tracking-widest">
          {form.itemId ? "EDIT ITEM" : "NEW ITEM"}
        </h2>
        <input
          required
          placeholder="Name (e.g. LinkedIn)"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className={INPUT}
        />
        <div>
          <p className="text-[10px] font-bold text-muted-foreground tracking-widest mb-1.5">
            ALLOWED SUB-CATEGORIES (none = all)
          </p>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => {
              const on = form.categoryIds.includes(c.id);
              return (
                <button
                  type="button"
                  key={c.id}
                  onClick={() =>
                    setForm({
                      ...form,
                      categoryIds: on
                        ? form.categoryIds.filter((x) => x !== c.id)
                        : [...form.categoryIds, c.id],
                    })
                  }
                  className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                    on ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-border"
                  }`}
                >
                  {c.icon} {c.name}
                </button>
              );
            })}
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
          Active (visible to sellers and buyers)
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className={`${BTN} bg-primary text-primary-foreground`}
          >
            {form.itemId ? "Save changes" : "Create item"}
          </button>
          {form.itemId && (
            <button
              type="button"
              onClick={() => setForm(EMPTY)}
              className={`${BTN} bg-secondary text-foreground`}
            >
              Cancel edit
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
