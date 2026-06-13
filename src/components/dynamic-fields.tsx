import type { CategorySubmissionField } from "@/lib/api/catalog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  fields: CategorySubmissionField[];
  values: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  heading?: string;
}

/**
 * Renders a list of dynamic fields configured per category by admins.
 * Used in seller listing creation (sellerFields) and at checkout
 * (buyerFields).
 */
export function DynamicFields({ fields, values, onChange, heading }: Props) {
  if (!fields || fields.length === 0) return null;
  const set = (key: string, v: string) => onChange({ ...values, [key]: v });
  return (
    <div className="space-y-2.5">
      {heading && <p className="text-xs font-bold">{heading}</p>}
      {fields.map((f) => (
        <div key={f.key} className="space-y-1.5">
          <Label className="text-xs">
            {f.label}
            {f.required && <span className="text-destructive"> *</span>}
          </Label>
          {f.type === "textarea" ? (
            <Textarea
              required={!!f.required}
              rows={3}
              value={values[f.key] ?? ""}
              onChange={(e) => set(f.key, e.target.value)}
              className="text-xs"
            />
          ) : f.type === "select" ? (
            <select
              required={!!f.required}
              value={values[f.key] ?? ""}
              onChange={(e) => set(f.key, e.target.value)}
              className="w-full bg-secondary border border-border rounded-md px-2 py-2 text-xs h-9"
            >
              <option value="">Select…</option>
              {(f.options ?? []).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : (
            <Input
              required={!!f.required}
              type={f.type === "number" ? "number" : "text"}
              value={values[f.key] ?? ""}
              onChange={(e) => set(f.key, e.target.value)}
            />
          )}
          {f.help && <p className="text-[10px] text-muted-foreground">{f.help}</p>}
        </div>
      ))}
    </div>
  );
}
