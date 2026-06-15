"use client";

import { useEffect, useState, useTransition } from "react";
import { listSellerApplications, reviewSellerApplication } from "@/server/actions/admin";
import { GENERIC_STATUS_CLS, dateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminSellers() {
  const [data, setData] = useState<Awaited<ReturnType<typeof listSellerApplications>> | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = () =>
    listSellerApplications()
      .then((d) => setData(d))
      .catch(() => {});

  useEffect(() => {
    let alive = true;
    listSellerApplications()
      .then((d) => {
        if (alive) setData(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const review = (vars: { applicationId: string; approve: boolean; note?: string }) => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        await reviewSellerApplication(vars);
        setSuccess("Application reviewed");
        load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      }
    });
  };

  return (
    <div className="space-y-3">
      <h1 className="font-display text-2xl">SELLER APPLICATIONS</h1>
      {error && (
        <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          {error}
        </p>
      )}
      {success && (
        <p className="text-xs text-accent bg-accent/10 border border-accent/30 rounded-md px-3 py-2">
          {success}
        </p>
      )}
      {data?.applications.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">No applications.</p>
      )}
      {data?.applications.map((a) => (
        <div key={a.id as string} className="bg-card border border-border rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="font-bold">{a.username}</span>
            <span className="text-muted-foreground">{a.email}</span>
            <span
              className={`text-[9px] font-bold px-2 py-0.5 rounded ${GENERIC_STATUS_CLS[a.status as string] ?? "bg-muted"}`}
            >
              {(a.status as string).toUpperCase()}
            </span>
            <span className="text-[10px] text-muted-foreground ml-auto">
              {dateTime(a.created_at as number)}
            </span>
          </div>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-xs">
            <p>
              <b>Legal name:</b> {a.full_name}
            </p>
            <p>
              <b>Country:</b> {a.country}
            </p>
            {a.display_name && (
              <p>
                <b>Store name:</b> {a.display_name}
              </p>
            )}
            {a.years_experience && (
              <p>
                <b>Experience:</b> {a.years_experience}
                {a.monthly_volume ? ` · vol ${a.monthly_volume}` : ""}
              </p>
            )}
            {a.product_categories && (
              <p className="sm:col-span-2">
                <b>Sells:</b> {a.product_categories}
              </p>
            )}
            <p className="sm:col-span-2">
              <b>Background:</b> {a.experience}
            </p>
            {a.source_of_goods && (
              <p className="sm:col-span-2">
                <b>Sourcing:</b> {a.source_of_goods}
              </p>
            )}
            {a.portfolio && (
              <p className="sm:col-span-2 break-all">
                <b>Portfolio:</b> {a.portfolio}
              </p>
            )}
            {(a.telegram || a.whatsapp || a.wechat) && (
              <p className="sm:col-span-2">
                <b>Contact:</b>
                {a.telegram ? ` Telegram ${a.telegram}` : ""}
                {a.whatsapp ? ` · WhatsApp ${a.whatsapp}` : ""}
                {a.wechat ? ` · WeChat ${a.wechat}` : ""}
              </p>
            )}
            <p className="sm:col-span-2 font-mono text-[11px]">
              <b className="font-body">Payout:</b> {a.usdt_payout_address} ({a.usdt_network})
            </p>
            {a.admin_note && (
              <p className="sm:col-span-2 text-muted-foreground">
                <b>Staff note:</b> {a.admin_note}
              </p>
            )}
          </div>
          {a.status === "pending" && (
            <div className="flex gap-2 items-center pt-1">
              <Input
                placeholder="Note (required for rejection)"
                className="max-w-xs h-8 text-xs"
                value={notes[a.id as string] ?? ""}
                onChange={(e) => setNotes({ ...notes, [a.id as string]: e.target.value })}
              />
              <Button
                size="sm"
                onClick={() =>
                  review({
                    applicationId: a.id as string,
                    approve: true,
                    note: notes[a.id as string] || undefined,
                  })
                }
                disabled={isPending}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  const note = notes[a.id as string];
                  if (!note) {
                    setError("Add a note explaining the rejection.");
                    return;
                  }
                  review({ applicationId: a.id as string, approve: false, note });
                }}
                disabled={isPending}
              >
                Reject
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
