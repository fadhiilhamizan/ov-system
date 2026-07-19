"use client";
import * as React from "react";
import { Check, ChevronsUpDown, X, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { useT } from "@/lib/i18n/provider";
import type { Member } from "@/lib/types";

// Reusable multi-select for choosing people (PIC) from the member roster.
// Stores a comma-joined string of display names (nickname || name) so it is a
// drop-in replacement for the old free-text PIC inputs. Free-text names that
// don't match a known member are preserved as extra chips (no data loss).
export function MemberPicker({
  members,
  value,
  onChange,
  placeholder,
}: {
  members: Member[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const t = useT();
  const [query, setQuery] = React.useState("");
  const label = (m: Member) => m.nickname || m.name;
  const tokens = React.useMemo(
    () => value.split(",").map((s) => s.trim()).filter(Boolean),
    [value],
  );
  const isSelected = (m: Member) => tokens.some((tok) => tok.toLowerCase() === label(m).toLowerCase());
  const extras = tokens.filter((tok) => !members.some((m) => label(m).toLowerCase() === tok.toLowerCase()));

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => `${m.name} ${m.nickname} ${m.nrp}`.toLowerCase().includes(q));
  }, [members, query]);

  function toggle(m: Member) {
    const next = isSelected(m)
      ? tokens.filter((tok) => tok.toLowerCase() !== label(m).toLowerCase())
      : [...tokens, label(m)];
    onChange(next.join(", "));
  }
  function removeToken(tok: string) {
    onChange(tokens.filter((x) => x.toLowerCase() !== tok.toLowerCase()).join(", "));
  }

  return (
    <div className="space-y-2">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex min-h-9 w-full items-center justify-between rounded-lg border border-input bg-card px-3 py-1.5 text-sm shadow-sm transition hover:bg-muted"
          >
            <span className={tokens.length ? "text-foreground" : "text-muted-foreground"}>
              {tokens.length ? `${tokens.length} ${t("dipilih")}` : (placeholder ?? t("Pilih anggota…"))}
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 opacity-60" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-0">
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("Cari nama / NRP…")}
                className="h-8 pl-8 text-sm"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto p-1.5">
            {members.length === 0 ? (
              <p className="p-2 text-xs text-muted-foreground">{t("Belum ada anggota untuk Ormawa Visit ini.")}</p>
            ) : filtered.length === 0 ? (
              <p className="p-2 text-xs text-muted-foreground">{t("Tidak ada anggota yang cocok.")}</p>
            ) : (
              filtered.map((m) => (
                <label
                  key={m.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <Checkbox checked={isSelected(m)} onCheckedChange={() => toggle(m)} />
                  <Avatar name={label(m)} size={22} />
                  <span className="flex-1 truncate">{label(m)}</span>
                  {isSelected(m) && <Check className="size-3.5 text-primary" />}
                </label>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>

      {tokens.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tokens.map((tok) => (
            <span
              key={tok}
              className={
                extras.includes(tok)
                  ? "inline-flex items-center gap-1 rounded-full bg-muted py-1 pl-2.5 pr-1 text-xs text-muted-foreground"
                  : "inline-flex items-center gap-1 rounded-full bg-accent py-1 pl-2.5 pr-1 text-xs text-accent-foreground"
              }
            >
              {tok}
              <button type="button" onClick={() => removeToken(tok)} className="rounded-full p-0.5 hover:bg-black/10">
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
