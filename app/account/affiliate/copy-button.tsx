"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function AffiliateCopyButton({ link, code }: { link: string; code: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex gap-2 items-center">
      <input
        readOnly
        value={link}
        className="flex-1 bg-background border border-border rounded-md px-2.5 py-1.5 text-xs font-mono"
      />
      <button
        onClick={() => {
          navigator.clipboard?.writeText(link).catch(() => {});
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-secondary hover:bg-secondary/80 rounded-md whitespace-nowrap"
      >
        {copied ? <Check className="size-3 text-accent" /> : <Copy className="size-3" />}
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
