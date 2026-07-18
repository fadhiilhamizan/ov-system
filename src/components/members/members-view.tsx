"use client";
import * as React from "react";
import { Search, Users2, IdCard, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty";
import {
  MemberFormDialog, MemberActions, TeamFormDialog, TeamActions,
} from "./member-manage";
import { cn } from "@/lib/utils";
import type { Division, Member, Team } from "@/lib/types";

export function MembersView({
  members,
  teams,
  divisions,
  eventId,
  eventTitle,
  canManageMembers,
  canManageTeams,
}: {
  members: Member[];
  teams: Team[];
  divisions: Division[];
  eventId: string;
  eventTitle: string;
  canManageMembers: boolean;
  canManageTeams: boolean;
}) {
  const [q, setQ] = React.useState("");
  const [type, setType] = React.useState<"all" | "fungsionaris" | "intern">("all");
  const divMap = new Map(divisions.map((d) => [d.key, d]));

  const filtered = members.filter((m) => {
    if (type !== "all" && m.type !== type) return false;
    if (q && !`${m.name} ${m.nickname} ${m.nrp}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const fungCount = members.filter((m) => m.type === "fungsionaris").length;
  const internCount = members.filter((m) => m.type === "intern").length;

  return (
    <Tabs defaultValue="anggota">
      <TabsList>
        <TabsTrigger value="anggota">
          <IdCard /> Anggota EA
        </TabsTrigger>
        <TabsTrigger value="tim">
          <Users2 /> Struktur Tim
        </TabsTrigger>
      </TabsList>

      <TabsContent value="anggota">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama / NRP…" className="pl-9" />
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-border bg-card p-0.5 text-xs">
              {([
                ["all", `Semua ${members.length}`],
                ["fungsionaris", `Fungsionaris ${fungCount}`],
                ["intern", `Intern ${internCount}`],
              ] as const).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setType(k as typeof type)}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 font-medium transition",
                    type === k ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {canManageMembers && (
              <MemberFormDialog mode="create" divisions={divisions} trigger={
                <DialogTrigger asChild>
                  <Button><Plus className="size-4" /> <span className="hidden sm:inline">Tambah</span></Button>
                </DialogTrigger>
              } />
            )}
          </div>
        </div>

        {filtered.length ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((m) => (
              <Card key={m.id} className="flex items-center gap-3 p-3.5">
                <Avatar name={m.nickname || m.name} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate font-semibold">{m.name}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">NRP {m.nrp || "-"}</p>
                </div>
                <Badge variant={m.type === "fungsionaris" ? "primary" : "info"}>
                  {m.type === "fungsionaris" ? "Fungsio" : "Intern"}
                </Badge>
                {canManageMembers && <MemberActions member={m} divisions={divisions} />}
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState icon={<IdCard />} title="Tidak ditemukan" description="Tidak ada anggota yang cocok." />
        )}
      </TabsContent>

      <TabsContent value="tim">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">Struktur tim untuk {eventTitle}</p>
          {canManageTeams && (
            <TeamFormDialog mode="create" divisions={divisions} eventId={eventId} trigger={
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="size-4" /> Tambah Tim</Button>
              </DialogTrigger>
            } />
          )}
        </div>
        {teams.length ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {teams.map((t) => {
              const div = divMap.get(t.division);
              return (
                <Card key={t.id} className="p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className="flex size-8 items-center justify-center rounded-lg text-xs font-bold text-white"
                      style={{ backgroundColor: div?.color ?? "#888" }}
                    >
                      {div?.short ?? "?"}
                    </span>
                    <h4 className="font-semibold">{div?.name ?? t.division}</h4>
                    {canManageTeams && (
                      <div className="ml-auto">
                        <TeamActions team={t} divisions={divisions} eventId={eventId} />
                      </div>
                    )}
                  </div>
                  {t.fungsionaris && (
                    <div className="mb-2">
                      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Fungsionaris</p>
                      <div className="flex flex-wrap gap-1.5">
                        {t.fungsionaris.split(/\s{2,}|,|·/).filter(Boolean).map((n, i) => (
                          <span key={i} className="rounded-full bg-muted px-2 py-0.5 text-xs">{n.trim()}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {t.intern && t.intern !== "-" && (
                    <div>
                      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Intern</p>
                      <div className="flex flex-wrap gap-1.5">
                        {t.intern.split(/\s{2,}|,|·/).filter(Boolean).map((n, i) => (
                          <span key={i} className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">{n.trim()}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        ) : (
          <EmptyState icon={<Users2 />} title="Belum ada struktur tim" description="Struktur tim untuk Ormawa Visit ini belum diisi." />
        )}
      </TabsContent>
    </Tabs>
  );
}
