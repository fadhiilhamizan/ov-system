"use client";
import * as React from "react";
import { CheckCheck, Inbox, Mail, MailOpen, Megaphone } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { markAllInboxReadAction, setInboxReadAction } from "@/lib/actions/inbox";
import { formatCommentTime } from "@/lib/task-comments";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import type { InboxMessage } from "@/lib/types";
import { useLocalFirst, type LocalFirst } from "@/lib/use-local-first";

// ============================================================
// One account's inbox.
//
// Read state is deliberately NOT set by simply rendering the page: opening a
// list of twelve messages does not mean you read twelve messages, and a badge
// that empties itself the moment you glance at the menu is a badge that never
// tells you anything again. A message is marked read when it is OPENED, and
// there is an explicit way to undo that and an explicit way to clear the lot.
// All three flip at once and save in the background (use-local-first.ts).
// ============================================================

function MessageCard({ message, store }: { message: InboxMessage; store: LocalFirst<InboxMessage> }) {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  const unread = !message.read_at;

  function toggle() {
    const next = !open;
    setOpen(next);
    // Opening an unread message is what marks it read. Closing it again does
    // not put it back: you did read it.
    if (next && unread) {
      store.patch(message.id, { read_at: new Date().toISOString() }, () => setInboxReadAction(message.id, true));
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
      </button>

      {open && (
        <div className="border-t border-border/60 px-4 py-3">
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.body}</p>
          {message.read_at && (
            <button
              type="button"
              onClick={() => store.patch(message.id, { read_at: null }, () => setInboxReadAction(message.id, false), {
                success: t("Ditandai belum dibaca"),
              })}
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

export function InboxView({ messages: serverMessages }: { messages: InboxMessage[] }) {
  const t = useT();
  const store = useLocalFirst(serverMessages);
  const messages = store.rows;
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
            onClick={() => store.patchMany(
              messages.filter((m) => !m.read_at).map((m) => m.id),
              { read_at: new Date().toISOString() },
              () => markAllInboxReadAction(),
              { success: t("Semua pesan ditandai sudah dibaca") },
            )}
          >
            <CheckCheck className="size-3.5" />
            {t("Tandai semua dibaca")}
          </Button>
        )}
      </div>
      <div className="space-y-2">
        {messages.map((m) => <MessageCard key={m.id} message={m} store={store} />)}
      </div>
    </div>
  );
}
