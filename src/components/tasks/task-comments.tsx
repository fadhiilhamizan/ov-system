"use client";
import * as React from "react";
import { toast } from "sonner";
import {
  Check, CornerDownRight, Loader2, MessageSquare, MessageSquarePlus, Send, Trash2, Undo2,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  deleteTaskCommentAction, replyTaskCommentAction, setTaskCommentResolvedAction,
  startTaskCommentAction,
} from "@/lib/actions/task-comments";
import { can } from "@/lib/permissions";
import { ROLE_META } from "@/lib/constants";
import { formatCommentTime, openThreadCount, sortThreads, toThreads } from "@/lib/task-comments";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import type { AppUser, Role, Task, TaskComment, TaskCommentThread } from "@/lib/types";
import { useTaskComments } from "./task-comments-context";

// ============================================================
// Catatan per tugas: a small chat hanging off one Work Breakdown row.
//
// Three surfaces, one set of pieces:
//   TaskCommentBadge  - the bell on the table row. Present only while the task
//                       has an OPEN thread; opens the mini chat in a popover.
//   TaskCommentsPanel - the full history inside the Edit dialog, finished
//                       threads included, plus the composer that starts a new
//                       one (admin / koordinator / staff).
//   ThreadCard        - one conversation, shared by both.
//
// Permissions differ per action and are checked again on the server; see
// lib/actions/task-comments.ts. Everything here is the UX half.
// ============================================================

/** Who wrote it, in what capacity, and when. */
function CommentBubble({
  comment,
  user,
  reply = false,
}: {
  comment: TaskComment;
  user: AppUser;
  reply?: boolean;
}) {
  const t = useT();
  const [pending, start] = React.useTransition();
  const canDelete = can.deleteTaskComment(user, comment.author_id);
  const roleLabel = ROLE_META[comment.author_role as Role]?.label;

  return (
    <div className={cn("flex gap-2", reply && "pl-4")}>
      {reply && <CornerDownRight className="mt-2 size-3.5 shrink-0 text-muted-foreground/50" />}
      <Avatar name={comment.author_name || "?"} size={24} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          <span className="text-xs font-semibold">{comment.author_name || t("Tanpa nama")}</span>
          {roleLabel && (
            <span className="text-[10px] text-muted-foreground">{t(roleLabel)}</span>
          )}
          <span className="text-[10px] text-muted-foreground/80">
            {formatCommentTime(comment.created_at)}
          </span>
          {canDelete && (
            <button
              type="button"
              disabled={pending}
              onClick={() => start(async () => {
                const res = await deleteTaskCommentAction(comment.id);
                if (res.ok) toast.success(t("Catatan dihapus"));
                else toast.error(res.error);
              })}
              className="ml-auto inline-flex items-center rounded p-0.5 text-muted-foreground/60 transition hover:text-danger disabled:opacity-50"
              aria-label={t("Hapus catatan")}
            >
              {pending ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
            </button>
          )}
        </div>
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{comment.body}</p>
      </div>
    </div>
  );
}

/**
 * The write box, shared by "start a thread" and "reply".
 *
 * Enter sends and Shift+Enter makes a new line, which is what a chat box is
 * expected to do; the button stays for touch and for discoverability.
 */
function Composer({
  placeholder,
  label,
  onSend,
  autoFocus = false,
}: {
  placeholder: string;
  label: string;
  onSend: (body: string) => Promise<boolean>;
  autoFocus?: boolean;
}) {
  const t = useT();
  const [body, setBody] = React.useState("");
  const [pending, start] = React.useTransition();

  function send() {
    const text = body.trim();
    if (!text || pending) return;
    start(async () => {
      // Only clear on success - a message the server refused has to stay in the
      // box, or a long note is gone with nothing to retry.
      if (await onSend(text)) setBody("");
    });
  }

  return (
    <div className="grid gap-1.5">
      <Textarea
        value={body}
        autoFocus={autoFocus}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
        placeholder={placeholder}
        className="min-h-[60px] text-sm"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-muted-foreground">
          {t("Enter kirim, Shift+Enter baris baru")}
        </span>
        <Button size="sm" onClick={send} disabled={pending || !body.trim()}>
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
          {label}
        </Button>
      </div>
    </div>
  );
}

/** One conversation: the initiation comment, its replies, and the reply box. */
function ThreadCard({ thread, user }: { thread: TaskCommentThread; user: AppUser }) {
  const t = useT();
  const [pending, start] = React.useTransition();
  const { root, replies } = thread;
  const canResolve = can.resolveTaskComment(user);
  const canReply = can.replyTaskComment(user);

  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        root.resolved
          ? "border-border bg-muted/30"
          : "border-amber-300/70 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/5",
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <Badge variant={root.resolved ? "success" : "warning"}>
          {root.resolved ? <Check className="size-3" /> : <MessageSquare className="size-3" />}
          {root.resolved ? t("Selesai") : t("Perlu ditindaklanjuti")}
        </Badge>
        {root.resolved && root.resolved_by && (
          <span className="truncate text-[10px] text-muted-foreground">
            {t("oleh")} {root.resolved_by}
          </span>
        )}
        {canResolve && (
          <button
            type="button"
            disabled={pending}
            onClick={() => start(async () => {
              const res = await setTaskCommentResolvedAction(root.id, !root.resolved);
              if (res.ok) {
                toast.success(root.resolved ? t("Catatan dibuka lagi") : t("Catatan ditandai selesai"));
              } else toast.error(res.error);
            })}
            className={cn(
              "ml-auto inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition disabled:opacity-50",
              root.resolved
                ? "border-border text-muted-foreground hover:bg-muted"
                : "border-emerald-500/60 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10",
            )}
          >
            {pending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : root.resolved ? (
              <Undo2 className="size-3" />
            ) : (
              <Check className="size-3" />
            )}
            {root.resolved ? t("Buka lagi") : t("Tandai selesai")}
          </button>
        )}
      </div>

      <div className="grid gap-2.5">
        <CommentBubble comment={root} user={user} />
        {replies.map((r) => (
          <CommentBubble key={r.id} comment={r} user={user} reply />
        ))}
      </div>

      {/* A finished thread stays replyable on purpose: the tick closes the
          notification, not the conversation. */}
      {canReply && (
        <div className="mt-3 border-t border-border/60 pt-2.5">
          <Composer
            placeholder={t("Tulis balasan…")}
            label={t("Balas")}
            onSend={async (body) => {
              const res = await replyTaskCommentAction({ parent_id: root.id, body });
              if (res.ok) toast.success(t("Balasan terkirim"));
              else toast.error(res.error);
              return res.ok;
            }}
          />
        </div>
      )}
    </div>
  );
}

/** The composer that STARTS a thread. Hidden for roles that may only reply. */
function StartThreadBox({ task, user }: { task: Task; user: AppUser }) {
  const t = useT();
  if (!can.startTaskComment(user)) {
    return (
      <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
        {t("Hanya admin, koordinator, dan staff yang bisa menambah catatan baru. Kamu tetap bisa membalas catatan yang ada.")}
      </p>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium">
        <MessageSquarePlus className="size-3.5" /> {t("Catatan baru untuk tugas ini")}
      </p>
      <Composer
        placeholder={t("Revisi, informasi tambahan, atau hal lain yang perlu disampaikan…")}
        label={t("Kirim catatan")}
        onSend={async (body) => {
          const res = await startTaskCommentAction({ task_id: task.id, body });
          if (res.ok) toast.success(t("Catatan ditambahkan"));
          else toast.error(res.error);
          return res.ok;
        }}
      />
    </div>
  );
}

/**
 * The whole history for a task, for the Edit dialog.
 *
 * Renders nothing at all when the page provided no comment data (see
 * `TaskCommentsProvider`) - an empty panel would read as "the notes are gone".
 */
export function TaskCommentsPanel({ task, user }: { task: Task; user: AppUser }) {
  const t = useT();
  const comments = useTaskComments(task.id);
  const threads = React.useMemo(() => sortThreads(toThreads(comments)), [comments]);
  if (comments === undefined) return null;

  return (
    <div className="grid gap-2.5">
      <div className="flex items-center gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <MessageSquare className="size-4" /> {t("Catatan & Diskusi")}
        </p>
        {threads.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {threads.length} {t("catatan")}
          </span>
        )}
      </div>
      <StartThreadBox task={task} user={user} />
      {threads.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("Belum ada catatan pada tugas ini.")}</p>
      ) : (
        threads.map((th) => <ThreadCard key={th.root.id} thread={th} user={user} />)
      )}
    </div>
  );
}

/**
 * The notification on a Work Breakdown row.
 *
 * Deliberately absent - not disabled, not greyed - when the task has no OPEN
 * thread: "tombol notifikasi tidak akan muncul jika tugas tersebut tidak
 * memiliki catatan". Ticking a thread as finished is what makes it go away
 * again; the conversation itself stays reachable from Edit.
 */
export function TaskCommentBadge({ task, user }: { task: Task; user: AppUser }) {
  const t = useT();
  const comments = useTaskComments(task.id);
  const open = openThreadCount(comments);
  const threads = React.useMemo(
    () => sortThreads(toThreads(comments)).filter((th) => !th.root.resolved),
    [comments],
  );
  if (!open) return null;

  return (
    <Popover>
      <PopoverTrigger
        aria-label={`${t("Lihat catatan tugas")} (${open})`}
        title={`${open} ${t("catatan belum selesai")}`}
        className="relative inline-flex size-7 items-center justify-center rounded-md text-amber-600 transition hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-amber-400 dark:hover:bg-amber-500/15"
      >
        <MessageSquare className="size-4" />
        <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[14px] items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold leading-[14px] text-white">
          {open}
        </span>
      </PopoverTrigger>
      {/* Wide enough to read a paragraph, capped so a long thread scrolls
          inside the popover instead of running off the screen. */}
      <PopoverContent align="end" className="max-h-[70vh] w-[360px] overflow-y-auto p-3">
        <p className="mb-2 line-clamp-2 text-xs text-muted-foreground">{task.title}</p>
        <div className="grid gap-2.5">
          {threads.map((th) => (
            <ThreadCard key={th.root.id} thread={th} user={user} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
