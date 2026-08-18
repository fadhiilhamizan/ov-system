"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty";
import { ago, full } from "./developer-view";
import { cn } from "@/lib/utils";
import type { PresenceEntry } from "@/lib/types";

// ============================================================
// Who is here right now.
//
// "Online" is a HEARTBEAT, not a connection. A browser that crashes, a laptop
// that sleeps, a tab closed by the OS - none of them send a goodbye, so any
// definition based on "still connected" would be a lie that never expires. A
// tab beats once a minute while it is visible, so anything seen in the last
// two and a half minutes is online and everything else is "was here".
// ============================================================

/** Two and a half beats: one missed heartbeat should not drop someone off. */
export const ONLINE_WINDOW_MS = 150_000;

export function PresencePanel({ entries }: { entries: PresenceEntry[] }) {
  const router = useRouter();
  const [now, setNow] = React.useState(() => Date.now());

  // The rows are a server snapshot, but "3 menit lalu" ages while you read it.
  // Re-ticking locally keeps the labels honest without re-querying.
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const online = entries.filter((p) => now - new Date(p.last_seen).getTime() < ONLINE_WINDOW_MS);
  const recent = entries.filter((p) => now - new Date(p.last_seen).getTime() >= ONLINE_WINDOW_MS);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Denyut dikirim tiap menit dari tab yang sedang terlihat. Tamu dan Mode Demo tidak dihitung.
        </p>
        <Button variant="outline" size="sm" onClick={() => router.refresh()}>
          <RefreshCw className="size-4" /> Muat ulang
        </Button>
      </div>

      <Section title={`Online sekarang (${online.length})`} dot="#10b981">
        {online.length === 0 ? (
          <EmptyState icon={<RefreshCw />} title="Tidak ada yang online" description="Belum ada denyut dalam 2,5 menit terakhir." />
        ) : (
          online.map((p) => <PersonRow key={p.user_id} p={p} live />)
        )}
      </Section>

      {recent.length > 0 && (
        <Section title={`Baru saja di sini (${recent.length})`} dot="#94a3b8">
          {recent.map((p) => <PersonRow key={p.user_id} p={p} />)}
        </Section>
      )}
    </div>
  );
}

function Section({ title, dot, children }: { title: string; dot: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <span className="size-2 rounded-full" style={{ backgroundColor: dot }} />
        {title}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function PersonRow({ p, live = false }: { p: PresenceEntry; live?: boolean }) {
  return (
    <Card className="flex items-center gap-3 p-3">
      <span className="relative">
        <Avatar name={p.name || p.email} size={32} />
        {live && (
          <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-card bg-emerald-500" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{p.name || p.email}</p>
        <p className="truncate text-[11px] text-muted-foreground">{p.email}</p>
      </div>
      <code className={cn("hidden shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] sm:block", !p.path && "opacity-50")}>
        {p.path || "-"}
      </code>
      {p.role && <Badge variant="outline" className="shrink-0 text-[10px]">{p.role}</Badge>}
      <time dateTime={p.last_seen} title={full(p.last_seen)} className="shrink-0 text-[11px] text-muted-foreground">
        {ago(p.last_seen)}
      </time>
    </Card>
  );
}
