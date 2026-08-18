"use client";
import * as React from "react";
import { Check, Database, GitCommitHorizontal, Minus, Server } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CHANGELOG, CHANGE_KIND } from "@/lib/changelog";
import { full } from "./developer-view";
import { cn } from "@/lib/utils";
import type { TableCount } from "@/lib/types";

// ============================================================
// Build, environment, database size, and version history.
//
// The env panel shows whether a key is SET, never what it is. This is the one
// screen in the app where printing a secret would feel justified, and it is
// also the screen most likely to end up in a screenshot or a screen-share while
// somebody is being shown a bug.
// ============================================================

export interface EnvFlag {
  key: string;
  set: boolean;
  note?: string;
}

export interface BuildInfo {
  version: string;
  node: string;
  env: string;
  commit: string;
  branch: string;
  commitMessage: string;
  serverTime: string;
  timeZone: string;
  developerCount: number;
}

export function SystemPanel({
  env, build, counts,
}: {
  env: EnvFlag[];
  build: BuildInfo;
  counts: TableCount[];
}) {
  const totalRows = counts.reduce((s, c) => s + Number(c.rows), 0);
  const max = Math.max(1, ...counts.map((c) => Number(c.rows)));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Server className="size-4 text-primary" /> Build
          </h3>
          <dl className="mt-3 space-y-1.5 text-sm">
            <Line k="Versi aplikasi" v={`v${build.version}`} mono />
            <Line k="Lingkungan" v={build.env} mono />
            {build.commit && <Line k="Commit" v={`${build.commit}${build.branch ? ` (${build.branch})` : ""}`} mono />}
            {build.commitMessage && <Line k="Pesan commit" v={build.commitMessage} />}
            <Line k="Node" v={build.node} mono />
            <Line k="Waktu server" v={full(build.serverTime)} />
            <Line k="Zona waktu server" v={build.timeZone} mono />
            <Line k="Akun developer terdaftar" v={String(build.developerCount)} mono />
          </dl>
          {!build.commit && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              Info commit hanya terisi di deployment (Vercel), bukan saat dijalankan lokal.
            </p>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <GitCommitHorizontal className="size-4 text-primary" /> Layanan
          </h3>
          <ul className="mt-3 space-y-1.5 text-sm">
            {env.map((e) => (
              <li key={e.key} className="flex items-center gap-2">
                {e.set ? (
                  <Check className="size-4 shrink-0 text-emerald-500" />
                ) : (
                  <Minus className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className="flex-1">{e.key}</span>
                <span className="text-xs text-muted-foreground">
                  {e.note ?? (e.set ? "terpasang" : "belum diatur")}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Hanya status terpasang atau tidak. Nilai kunci tidak pernah ditampilkan di sini.
          </p>
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Database className="size-4 text-primary" /> Isi database
          <span className="ml-auto text-xs font-normal text-muted-foreground">{totalRows} baris total</span>
        </h3>
        {counts.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Belum bisa dibaca. Fungsi <code className="font-mono">table_counts()</code> ada di migrasi 0039.
          </p>
        ) : (
          <div className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {counts.map((c) => (
              <div key={c.table_name} className="flex items-center gap-2 text-sm">
                <code className="w-36 shrink-0 truncate font-mono text-xs">{c.table_name}</code>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-primary/70"
                    style={{ width: `${Math.round((Number(c.rows) / max) * 100)}%` }}
                  />
                </span>
                <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{c.rows}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold">Riwayat versi</h3>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Sumbernya sama dengan changelog di Pengaturan, tapi di sini seluruhnya, tanpa dipangkas.
        </p>
        <ol className="mt-3 space-y-4">
          {CHANGELOG.map((entry) => (
            <li key={entry.version} className="relative border-l border-border pl-4">
              <span
                className={cn(
                  "absolute -left-[5px] top-1.5 size-2.5 rounded-full",
                  entry.version === build.version ? "bg-primary ring-4 ring-primary/15" : "bg-border",
                )}
              />
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-sm font-semibold">v{entry.version}</span>
                <span className="text-[11px] text-muted-foreground">{entry.date}</span>
                {entry.version === build.version && (
                  <Badge variant="primary" className="text-[10px]">terpasang</Badge>
                )}
              </div>
              <p className="text-sm">{entry.title}</p>
              <ul className="mt-1.5 space-y-1">
                {entry.changes.map((c, i) => (
                  <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                    <span className={cn("mt-0.5 h-fit shrink-0 rounded px-1 py-0 text-[9px] font-semibold uppercase", CHANGE_KIND[c.kind].className)}>
                      {CHANGE_KIND[c.kind].label}
                    </span>
                    <span>{c.text}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

function Line({ k, v, mono = false }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="w-44 shrink-0 text-xs text-muted-foreground">{k}</dt>
      <dd className={cn("min-w-0 break-words", mono && "font-mono text-xs")}>{v}</dd>
    </div>
  );
}
