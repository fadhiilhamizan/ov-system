"use client";
import * as React from "react";
import { FlaskConical, UserRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AccessCount } from "@/lib/types";

// ============================================================
// How often the two account-less doors get used.
//
// Neither leaves a trace anywhere else: "Masuk sebagai Tamu" creates a SHARED
// anonymous identity, and "Coba Mode Demo" does not sign anyone in at all, it
// just points the app at a different database. So neither shows up in the
// roster, the audit trail, or the presence list, and the only way to know
// whether they are used at all is to count the presses.
//
// A DAILY counter, not one row per press: both doors are reachable without an
// account, so the write path is public. A counter can at worst be inflated; a
// row-per-event table could be filled.
// ============================================================

const META = {
  guest: {
    label: "Masuk sebagai Tamu",
    hint: "Sesi anonim, hanya lihat",
    icon: UserRound,
    color: "#0ea5e9",
  },
  demo: {
    label: "Coba Mode Demo",
    hint: "Database contoh yang terpisah",
    icon: FlaskConical,
    color: "#f59e0b",
  },
} as const;

export function AccessPanel({ counts }: { counts: AccessCount[] }) {
  // Read the clock ONCE per mount rather than on every render: "today" is what
  // splits the figures, and a value that changes between renders would make the
  // numbers wobble for no visible reason.
  const [now] = React.useState(() => Date.now());
  const today = new Date(now).toISOString().slice(0, 10);
  const since = (days: number) =>
    new Date(now - days * 86_400_000).toISOString().slice(0, 10);

  const sum = (kind: "guest" | "demo", from?: string) =>
    counts
      .filter((c) => c.kind === kind && (!from || c.day >= from))
      .reduce((n, c) => n + c.hits, 0);

  // Days with any traffic at all, newest first, for the little sparkline table.
  const days = [...new Set(counts.map((c) => c.day))].sort().reverse().slice(0, 14);
  const peak = Math.max(1, ...counts.map((c) => c.hits));

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold">Masuk tanpa akun</h3>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Dihitung sejak migrasi 0040 dipasang. Keduanya tidak meninggalkan jejak di tempat lain:
        Tamu memakai satu identitas anonim bersama, dan Mode Demo tidak login sama sekali.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {(["guest", "demo"] as const).map((kind) => {
          const m = META[kind];
          const Icon = m.icon;
          return (
            <div key={kind} className="rounded-xl border border-border p-3">
              <div className="flex items-center gap-2">
                <span
                  className="flex size-7 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `color-mix(in srgb, ${m.color} 14%, transparent)`, color: m.color }}
                >
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{m.label}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{m.hint}</p>
                </div>
              </div>
              <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
                <Figure label="Hari ini" value={sum(kind, today)} />
                <Figure label="7 hari" value={sum(kind, since(7))} />
                <Figure label="Total" value={sum(kind)} strong />
              </div>
            </div>
          );
        })}
      </div>

      {days.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            14 hari terakhir yang tercatat
          </p>
          <div className="space-y-1">
            {days.map((day) => {
              const g = counts.find((c) => c.day === day && c.kind === "guest")?.hits ?? 0;
              const d = counts.find((c) => c.day === day && c.kind === "demo")?.hits ?? 0;
              return (
                <div key={day} className="flex items-center gap-2 text-[11px]">
                  <span className="w-20 shrink-0 font-mono text-muted-foreground">{day}</span>
                  <span className="flex h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <span style={{ width: `${(g / peak) * 100}%`, backgroundColor: META.guest.color }} />
                    <span style={{ width: `${(d / peak) * 100}%`, backgroundColor: META.demo.color }} />
                  </span>
                  <span className="w-24 shrink-0 text-right tabular-nums text-muted-foreground">
                    {g} tamu · {d} demo
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {counts.length === 0 && (
        <p className="mt-3 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          Belum ada yang tercatat. Angkanya mulai naik begitu ada yang menekan
          &ldquo;Masuk sebagai Tamu&rdquo; atau &ldquo;Coba Mode Demo&rdquo; di halaman login.
        </p>
      )}
    </Card>
  );
}

function Figure({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="rounded-lg bg-muted/50 py-1.5">
      <p className={cn("tabular-nums", strong ? "text-lg font-semibold" : "text-sm font-medium")}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
