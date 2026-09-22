"use client";
import * as React from "react";
import { toast } from "sonner";
import { CheckCheck, Inbox, Loader2, Mail, MailOpen, Megaphone } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { markAllInboxReadAction, setInboxReadAction } from "@/lib/actions/inbox";
import { formatCommentTime } from "@/lib/task-comments";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import type { InboxMessage } from "@/lib/types";

// ============================================================
// One account's inbox.
//
// Read state is deliberately NOT set by simply rendering the page: opening a
// list of twelve messages does not mean you read twelve messages, and a badge
// that empties itself the moment you glance at the menu is a badge that never
// tells you anything again. A message is marked read when it is OPENED, and
// there is an explicit way to undo that and an explicit way to clear the lot.
// ============================================================

function MessageCard({ message }: { message: InboxMessage }) {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const unread = !message.read_at;

  function toggle() {
    const next = !open;
    setOpen(next);
    // Opening an unread message is what marks it read. Closing it again does
    // not put it back: you did read it.
    if (next && unread) {
      start(async () => {
        const res = await setInboxReadAction(message.id, true);
        if (!res.ok) toast.error(res.error);
      });
    }
  }

  return (
    <div
      className={cn(
        "rounded-xl border transition-colors",
        unread
          ? "border-primary/40 bg-accent/40"
          : "border-border bg-card",
      )}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-start gap-3 rounded-xl px-4 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="mt-0.5 shrink-0 text-muted-foreground">
          {unread ? <Mail className="size-4 text-primary" /> : <MailOpen className="size-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={cn("text-sm", unread ? "font-semibold" : "font-medium")}>
              {message.title}
            </span>
            {unread && <Badge variant="primary">{t("Baru")}</Badge>}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
            <Avatar name={message.created_by_name || "?"} size={16} />
            {message.created_by_name || t("Admin")}
            <span aria-hidden>·</span>
            {formatCommentTime(message.created_at)}
            {message.updated_at && (
              <>
                <span aria-hidden>·</span>
                {t("diubah")} {formatCommentTime(message.updated_at)}
              </>
            )}
          </span>
          {!open && (
            <span className="mt-1 line-clamp-1 block text-xs text-muted-foreground">
              {message.body}
            </span>
          )}
        </span>
        {pending && <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t border-border/60 px-4 py-3">
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.body}</p>
          {message.read_at && (
            <button
              type="button"
              onClick={() => start(async () => {
                const res = await setInboxReadAction(message.id, false);
                if (res.ok) toast.success(t("Ditandai belum dibaca"));
                else toast.error(res.error);
              })}
              disabled={pending}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition hover:bg-muted disabled:opacity-50"
            >
              <Mail className="size-3" /> {t("Tandai belum dibaca")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function InboxView({ messages }: { messages: InboxMessage[] }) {
  const t = useT();
  const [pending, start] = React.useTransition();
  const unread = messages.filter((m) => !m.read_at).length;

  if (!messages.length) {
    return (
      <EmptyState
        icon={<Inbox />}
        title={t("Kotak masuk kosong")}
        description={t("Pengumuman dan siaran dari admin akan muncul di sini.")}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <Megaphone className="size-4" />
          {unread
            ? `${unread} ${t("pesan belum dibaca")}`
            : t("Semua pesan sudah dibaca")}
        </p>
        {unread > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            disabled={pending}
            onClick={() => start(async () => {
              const res = await markAllInboxReadAction();
              if (res.ok) toast.success(t("Semua pesan ditandai sudah dibaca"));
              else toast.error(res.error);
            })}
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCheck className="size-3.5" />}
            {t("Tandai semua dibaca")}
          </Button>
        )}
      </div>
      <div className="space-y-2">
        {messages.map((m) => <MessageCard key={m.id} message={m} />)}
      </div>
    </div>
  );
}
