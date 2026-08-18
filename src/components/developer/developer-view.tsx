"use client";
import * as React from "react";
import {
  Activity, AlertTriangle, Database, Radio, ScrollText, TerminalSquare, Users2, ShieldAlert,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ActivityFeed } from "./activity-feed";
import { PresencePanel } from "./presence-panel";
import { ActorPanel } from "./actor-panel";
import { ErrorPanel } from "./error-panel";
import { ConsolePanel } from "./console-panel";
import { SystemPanel, type BuildInfo, type EnvFlag } from "./system-panel";
import { ONLINE_WINDOW_MS } from "./presence-panel";
import type {
  ActivityEntry, ActorStat, AppUser, ErrorEntry, PresenceEntry, TableCount,
} from "@/lib/types";

// ============================================================
// The Developer menu.
//
// Deliberately NOT translated. Every other screen goes through the i18n dict,
// but adding these strings to dict.en.ts would put "Jejak Audit" and "Siapa
// Online" in a file that ships to every browser - the one place a hidden menu
// would leak its own existence. The audience is one person who wrote it.
// ============================================================

export function DeveloperView({
  me, registered, activity, actors, presence, errors, counts, env, build,
}: {
  me: AppUser;
  /** The signed-in address is on the app allowlist AND in the developers table. */
  registered: boolean;
  activity: ActivityEntry[];
  actors: ActorStat[];
  presence: PresenceEntry[];
  errors: ErrorEntry[];
  counts: TableCount[];
  env: EnvFlag[];
  build: BuildInfo;
}) {
  const openErrors = errors.filter((e) => !e.resolved).length;
  // Read once at mount and re-ticked on a timer, not on every render: "who is
  // online" is a moving target, and calling Date.now() while rendering makes
  // the number depend on when React happened to re-run the component.
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);
  const online = presence.filter((p) => now - new Date(p.last_seen).getTime() < ONLINE_WINDOW_MS);
  const lastEdit = activity[0];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <TerminalSquare className="size-5 text-primary" />
            Developer
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Perkakas internal. Menu ini tidak terdaftar di navigasi, pencarian, matriks hak akses,
            Panduan, maupun Violet, dan membalas 404 untuk siapa pun di luar daftar email developer.
          </p>
        </div>
        <Badge variant="outline" className="font-mono text-[11px]">{me.email}</Badge>
      </header>

      {/* Half-finished install is the failure mode worth calling out loudly: the
          allowlist opens the door, the developers TABLE is what makes the data
          readable, and with only the first one done every panel is just empty. */}
      {!registered && (
        <Card className="flex items-start gap-3 border-amber-500/40 bg-amber-500/5 p-4">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-500" />
          <div className="text-sm">
            <p className="font-medium">Emailmu belum terdaftar di database.</p>
            <p className="mt-1 text-muted-foreground">
              Menu ini terbuka karena alamatmu ada di <code className="font-mono">DEVELOPER_EMAILS</code>,
              tapi RLS yang memegang datanya membaca tabel <code className="font-mono">developers</code>,
              dan di sana alamatmu belum ada. Selama itu, semua panel di bawah akan kosong.
              Jalankan <code className="font-mono">supabase/migrations/0039_developer_tooling.sql</code>{" "}
              lalu <code className="font-mono">supabase/developers.local.sql</code> di SQL editor.
            </p>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Online sekarang" value={online.length} icon={<Radio className="size-4" />} accent="#10b981" />
        <Stat label="Error belum ditangani" value={openErrors} icon={<AlertTriangle className="size-4" />} accent={openErrors ? "#ef4444" : "#94a3b8"} />
        <Stat label="Perubahan tercatat" value={activity.length} icon={<Activity className="size-4" />} accent="#6366f1" sub={activity.length >= 200 ? "200 terbaru" : undefined} />
        <Stat label="Akun pernah menulis" value={actors.length} icon={<Users2 className="size-4" />} accent="#f59e0b" />
      </div>

      {lastEdit && (
        <Card className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Perubahan terakhir
          </p>
          <p className="mt-1.5 text-sm">
            <span className="font-medium">{lastEdit.actor_email || "(tanpa email)"}</span>{" "}
            {verb(lastEdit.action)}{" "}
            <span className="font-mono text-xs">{lastEdit.table_name}</span>
            {lastEdit.label && <> &ldquo;{lastEdit.label}&rdquo;</>}
            {" - "}
            <time dateTime={lastEdit.at} className="text-muted-foreground">{full(lastEdit.at)}</time>
          </p>
        </Card>
      )}

      <Tabs defaultValue="aktivitas">
        <TabsList>
          <TabsTrigger value="aktivitas"><ScrollText /> Aktivitas</TabsTrigger>
          <TabsTrigger value="online"><Radio /> Online</TabsTrigger>
          <TabsTrigger value="akun"><Users2 /> Akun</TabsTrigger>
          <TabsTrigger value="error">
            <AlertTriangle /> Error{openErrors > 0 && <span className="ml-1 rounded-full bg-danger px-1.5 text-[10px] font-semibold text-white">{openErrors}</span>}
          </TabsTrigger>
          <TabsTrigger value="konsol"><TerminalSquare /> Konsol</TabsTrigger>
          <TabsTrigger value="sistem"><Database /> Sistem</TabsTrigger>
        </TabsList>

        <TabsContent value="aktivitas"><ActivityFeed entries={activity} /></TabsContent>
        <TabsContent value="online"><PresencePanel entries={presence} /></TabsContent>
        <TabsContent value="akun"><ActorPanel actors={actors} presence={presence} /></TabsContent>
        <TabsContent value="error"><ErrorPanel errors={errors} /></TabsContent>
        <TabsContent value="konsol"><ConsolePanel /></TabsContent>
        <TabsContent value="sistem"><SystemPanel env={env} build={build} counts={counts} /></TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({
  label, value, icon, accent, sub,
}: {
  label: string; value: number; icon: React.ReactNode; accent: string; sub?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <span style={{ color: accent }}>{icon}</span>
        {label}
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </Card>
  );
}

export const verb = (action: string) =>
  action === "insert" ? "menambah" : action === "delete" ? "menghapus" : "mengubah";

/** Full local timestamp. The audit trail is the one place a relative "2 jam
 *  lalu" is not good enough - you need to line it up against other evidence. */
export const full = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

/** Compact "how long ago", for lists where the exact second is noise. */
export function ago(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s} detik lalu`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} menit lalu`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.round(h / 24)} hari lalu`;
}
