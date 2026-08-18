"use client";
import * as React from "react";
import { Users2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty";
import { ago, full } from "./developer-view";
import type { ActorStat, PresenceEntry } from "@/lib/types";

// ============================================================
// How much each account has actually written.
//
// Aggregated in the DATABASE (activity_by_actor, migration 0039) rather than by
// counting the rows loaded into the feed: the feed is capped at the 200 most
// recent entries, so counting those would quietly answer a different question
// than the one being asked.
//
// The bar is relative to the busiest account. An absolute scale would be
// meaningless - "142 edits" is a lot for a two-week edition and nothing for a
// whole cabinet year.
// ============================================================

export function ActorPanel({ actors, presence }: { actors: ActorStat[]; presence: PresenceEntry[] }) {
  const seen = React.useMemo(
    () => new Map(presence.map((p) => [p.user_id, p.last_seen])),
    [presence],
  );
  const max = Math.max(1, ...actors.map((a) => a.edits));
  const total = actors.reduce((s, a) => s + a.edits, 0);

  if (!actors.length) {
    return (
      <EmptyState
        icon={<Users2 />}
        title="Belum ada aktivitas tercatat"
        description="Hitungannya diambil dari jejak audit, yang mulai terisi setelah migrasi 0039 dijalankan."
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {total} perubahan oleh {actors.length} akun. Dihitung dari seluruh jejak audit, bukan hanya yang tampil di tab Aktivitas.
      </p>
      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Akun</TableHead>
              <TableHead className="w-[28%]">Total</TableHead>
              <TableHead className="text-right">Tambah</TableHead>
              <TableHead className="text-right">Ubah</TableHead>
              <TableHead className="text-right">Hapus</TableHead>
              <TableHead>Terakhir menulis</TableHead>
              <TableHead>Terakhir terlihat</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {actors.map((a) => {
              const lastSeen = a.actor_id ? seen.get(a.actor_id) : undefined;
              return (
                <TableRow key={a.actor_id ?? a.actor_email}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={a.actor_email || "?"} size={28} />
                      <div className="min-w-0">
                        <p className="truncate text-sm">{a.actor_email || "(tanpa email)"}</p>
                        {a.actor_role && (
                          <Badge variant="outline" className="mt-0.5 px-1 py-0 text-[10px]">{a.actor_role}</Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="w-10 shrink-0 text-sm font-semibold tabular-nums">{a.edits}</span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{ width: `${Math.round((a.edits / max) * 100)}%` }}
                        />
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-emerald-600 dark:text-emerald-400">{a.inserts}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-sky-600 dark:text-sky-400">{a.updates}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-danger">{a.deletes}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {a.last_edit ? <span title={full(a.last_edit)}>{ago(a.last_edit)}</span> : "-"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {lastSeen ? <span title={full(lastSeen)}>{ago(lastSeen)}</span> : "-"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
