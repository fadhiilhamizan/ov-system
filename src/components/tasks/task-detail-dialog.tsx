"use client";
import * as React from "react";
import { ExternalLink, CalendarDays, User, Hash, Link2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DivisionBadge } from "@/components/division-badge";
import { StatusMenu } from "./status-menu";
import { Badge } from "@/components/ui/badge";
import { formatDate, isUrl } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import type { AppUser, Division, OVEvent, Task } from "@/lib/types";

function ResultValue({ value }: { value: string }) {
  const t = useT();
  if (!value) return <span className="text-muted-foreground">-</span>;
  const parts = value.split(/\s+/).filter(Boolean);
  const urls = parts.filter(isUrl);
  if (urls.length === 0) return <span className="whitespace-pre-wrap">{value}</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {urls.map((u, i) => (
        <a
          key={i}
          href={u}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium text-primary transition hover:bg-muted"
        >
          <ExternalLink className="size-3.5" /> {t("Tautan")} {urls.length > 1 ? i + 1 : t("hasil")}
        </a>
      ))}
    </div>
  );
}

export function TaskDetailDialog({
  task,
  division,
  event,
  user,
  children,
}: {
  task: Task;
  division?: Division;
  event?: OVEvent;
  user: AppUser;
  children: React.ReactNode;
}) {
  const t = useT();
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            {division && <DivisionBadge division={division} />}
            <StatusMenu task={task} user={user} />
            {event && <Badge variant="outline">{event.code}</Badge>}
          </div>
          <DialogTitle className="text-base leading-snug">{task.title}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field icon={<User />} label="PIC">
              {task.pic || "-"}
            </Field>
            <Field icon={<Hash />} label={t("Nomor")}>
              {task.no || "-"}
            </Field>
            <Field icon={<CalendarDays />} label={t("Mulai")}>
              {formatDate(task.start_date) ?? task.start_raw ?? "-"}
            </Field>
            <Field icon={<CalendarDays />} label={t("Deadline")}>
              {formatDate(task.end_date) ?? task.end_raw ?? "-"}
            </Field>
          </div>

          {task.notes && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">{t("Important Notes")}</p>
              <p className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-3 text-sm leading-relaxed">
                {task.notes}
              </p>
            </div>
          )}

          <div>
            <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Link2 className="size-3.5" /> {t("Result / Hasil")}
            </p>
            <ResultValue value={task.result} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className="truncate font-medium">{children}</div>
      </div>
    </div>
  );
}
