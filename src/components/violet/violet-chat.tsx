"use client";
import * as React from "react";
import {
  Sparkles, Send, X, ExternalLink, Trash2, RotateCw, Copy, Check,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { askVioletAction, type VioletSource } from "@/lib/actions/violet";
import { toPlainText } from "@/lib/violet/markdown";
import { scrollToAnchor } from "@/lib/scroll-to-anchor";
import { useT } from "@/lib/i18n/provider";
import { RichText } from "./rich-text";

interface Msg {
  role: "user" | "model";
  text: string;
  sources?: VioletSource[];
  /** Set on a failed turn: the bubble turns into an error card. */
  failed?: boolean;
  /** Whether a "try again" button is worth offering (see lib/violet/errors). */
  retryable?: boolean;
}

const SUGGESTIONS = [
  "Apa saja yang bisa kamu lakukan?",
  "Bagaimana cara mengisi hasil tugas?",
  "Siapa saja yang boleh menghapus tugas?",
  "Ada tugas apa saja yang overtime?",
];

/**
 * Violet: a support assistant scoped to this system.
 *
 * The conversation lives in component state only. It is deliberately NOT
 * persisted: the answers are grounded in live data that changes, so a
 * transcript from last week would quote figures that are no longer true, and
 * storing chat about a roster would create a second copy of PII outside RLS.
 */
export function VioletChat() {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  const [msgs, setMsgs] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState("");
  const [pending, setPending] = React.useState(false);
  /** The last question, so a failed turn can be retried without retyping it. */
  const [lastAsked, setLastAsked] = React.useState("");
  const listRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  // Keep the newest turn in view as the answer arrives.
  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, pending]);

  // Re-opening the panel lands at the bottom, on the latest exchange.
  //
  // The conversation survives closing the panel, so without this you came back
  // to the top of a long transcript and had to scroll down to find the answer
  // you had just asked for. Jumped instantly rather than animated: this is
  // where the panel STARTS, not a movement the user should watch.
  //
  // Repeated rather than done once, and that is not belt-and-braces. Measured:
  // one frame after opening, the list reported scrollHeight 421 against its
  // final 697 - the transcript is still being laid out, so scrolling "to the
  // bottom" then lands well short of it. Each repeat is idempotent.
  React.useEffect(() => {
    if (!open) return;
    const toBottom = () => {
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    };
    const raf = requestAnimationFrame(toBottom);
    const timers = [100, 300].map((ms) => window.setTimeout(toBottom, ms));
    return () => {
      cancelAnimationFrame(raf);
      for (const t of timers) window.clearTimeout(t);
    };
  }, [open]);

  // Escape closes the panel, the way every other overlay in the app behaves.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  React.useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function ask(question: string, { replaceLast = false } = {}) {
    const q = question.trim();
    if (!q || pending) return;
    setInput("");
    setLastAsked(q);

    // A retry drops the failed answer instead of stacking a second error under
    // the same question.
    const base = replaceLast ? msgs.slice(0, -1) : [...msgs, { role: "user" as const, text: q }];

    // Only completed exchanges become history; a failed turn would poison the
    // follow-up context with an error message.
    const history = base
      .filter((m) => !m.failed)
      .map((m) => ({ role: m.role, text: m.text }));

    setMsgs(base);
    setPending(true);
    const res = await askVioletAction(q, history);
    setPending(false);
    setMsgs((prev) => [
      ...prev,
      res.ok
        ? { role: "model", text: res.answer, sources: res.sources }
        : { role: "model", text: res.error, failed: true, retryable: res.retryable },
    ]);
    inputRef.current?.focus();
  }

  const close = () => setOpen(false);

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label={t("Buka Violet")}
          className="group fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 transition hover:shadow-xl hover:shadow-violet-600/35 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2 focus:ring-offset-background"
        >
          <Sparkles className="size-4 transition group-hover:rotate-12" /> Violet
        </button>
      )}

      {open && (
        <div className="animate-fade-in fixed inset-x-3 bottom-3 z-40 flex max-h-[82dvh] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:inset-x-auto sm:right-4 sm:w-[420px]">
          {/* Header */}
          <div className="flex items-center gap-2.5 bg-gradient-to-br from-violet-500 to-violet-700 px-4 py-3 text-white">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
              <Sparkles className="size-4" />
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-sm font-semibold">Violet</p>
              <p className="truncate text-[11px] text-white/75">
                {t("Asisten Ormawa Visit Management System")}
              </p>
            </div>
            {msgs.length > 0 && (
              <IconBtn onClick={() => setMsgs([])} label={t("Bersihkan percakapan")}>
                <Trash2 className="size-4" />
              </IconBtn>
            )}
            <IconBtn onClick={close} label={t("Tutup")}>
              <X className="size-4" />
            </IconBtn>
          </div>

          {/* Transcript */}
          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-muted/20 p-3">
            {msgs.length === 0 && !pending && (
              <div className="space-y-3 py-1">
                <div className="rounded-2xl rounded-tl-sm border border-border bg-card p-3">
                  <p className="text-sm">
                    {t("Halo! Aku Violet. Aku hanya menjawab seputar sistem ini: menu, cara pakai, hak akses, dan datanya.")}
                  </p>
                </div>
                <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t("Coba tanyakan")}
                </p>
                <div className="flex flex-col gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => ask(s)}
                      className="rounded-xl border border-border bg-card px-3 py-2 text-left text-xs transition hover:border-violet-300 hover:bg-violet-50 dark:hover:border-violet-500/40 dark:hover:bg-violet-500/10"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {msgs.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-line rounded-2xl rounded-br-sm bg-gradient-to-br from-violet-500 to-violet-700 px-3 py-2 text-sm text-white shadow-sm">
                    {m.text}
                  </div>
                </div>
              ) : m.failed ? (
                <ErrorBubble
                  key={i}
                  text={m.text}
                  onRetry={m.retryable && !pending ? () => ask(lastAsked, { replaceLast: true }) : undefined}
                  retryLabel={t("Coba lagi")}
                />
              ) : (
                <AnswerBubble key={i} msg={m} onNavigate={close} t={t} />
              ),
            )}

            {pending && (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-2xl rounded-tl-sm border border-border bg-card px-3 py-2.5 text-sm text-muted-foreground">
                  <Dots />
                  {t("Violet sedang mengetik…")}
                </div>
              </div>
            )}
          </div>

          {/* Composer */}
          <form
            onSubmit={(e) => { e.preventDefault(); ask(input); }}
            className="flex items-end gap-2 border-t border-border bg-card p-2"
          >
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                // Enter sends, Shift+Enter makes a new line: chat convention.
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input); }
              }}
              placeholder={t("Tanya tentang sistem ini…")}
              maxLength={1000}
              disabled={pending}
              className="autosize max-h-28 min-h-[38px] flex-1 resize-none rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={pending || !input.trim()}
              aria-label={t("Kirim")}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow-sm transition hover:brightness-110 disabled:opacity-40 disabled:shadow-none"
            >
              <Send className="size-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

/** One answer, with its markdown rendered and its sources underneath. */
function AnswerBubble({
  msg,
  onNavigate,
  t,
}: {
  msg: Msg;
  onNavigate: () => void;
  t: (s: string) => string;
}) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(toPlainText(msg.text));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied (insecure origin, permissions). Not
      // worth an error toast for a convenience button.
    }
  }

  return (
    <div className="group flex justify-start">
      <div className="max-w-[92%] rounded-2xl rounded-tl-sm border border-border bg-card px-3 py-2.5 shadow-sm">
        <RichText text={msg.text} onNavigate={onNavigate} />

        {!!msg.sources?.length && (
          <div className="mt-2.5 border-t border-border/60 pt-2">
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("Sumber")}
            </p>
            <div className="flex flex-wrap gap-1">
              {msg.sources.map((s, j) =>
                s.href ? (
                  <Link
                    key={j}
                    href={s.href}
                    onClick={() => {
                      onNavigate();
                      // Covers the one case a route change does not: already
                      // being on that exact URL, where Next fires nothing and
                      // the page would simply not move.
                      window.setTimeout(() => scrollToAnchor(s.href!.split("#")[1]), 80);
                    }}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground transition hover:border-violet-300 hover:text-violet-600 dark:hover:border-violet-500/40 dark:hover:text-violet-300"
                  >
                    {s.source} <ExternalLink className="size-2.5" />
                  </Link>
                ) : (
                  <span
                    key={j}
                    className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground"
                  >
                    {s.source}
                  </span>
                ),
              )}
            </div>
          </div>
        )}

        <button
          onClick={copy}
          aria-label={t("Salin jawaban")}
          className="mt-2 inline-flex items-center gap-1 text-[10px] text-muted-foreground opacity-0 transition hover:text-foreground focus:opacity-100 group-hover:opacity-100"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? t("Tersalin") : t("Salin")}
        </button>
      </div>
    </div>
  );
}

/**
 * A failure, told plainly.
 *
 * Deliberately not styled as a chat bubble: an out-of-quota notice is a status
 * message about the tool, not something Violet said, and the retry button only
 * appears when retrying can actually help.
 */
function ErrorBubble({
  text,
  onRetry,
  retryLabel,
}: {
  text: string;
  onRetry?: () => void;
  retryLabel: string;
}) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] rounded-2xl rounded-tl-sm border border-amber-300/70 bg-amber-50 px-3 py-2.5 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
        <p className="flex gap-2 text-amber-900 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
          <span>{text}</span>
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-amber-400/60 px-2.5 py-1 text-xs font-medium text-amber-900 transition hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-500/15"
          >
            <RotateCw className="size-3.5" /> {retryLabel}
          </button>
        )}
      </div>
    </div>
  );
}

/** Three bouncing dots. Reads as "composing" rather than "loading a page". */
function Dots() {
  return (
    <span className="flex items-center gap-1">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="size-1.5 animate-bounce rounded-full bg-violet-400"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}

function IconBtn({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="rounded-lg p-1.5 text-white/90 transition hover:bg-white/15 hover:text-white"
    >
      {children}
    </button>
  );
}
