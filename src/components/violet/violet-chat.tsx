"use client";
import * as React from "react";
import { Sparkles, Send, X, Loader2, ExternalLink, Trash2 } from "lucide-react";
import Link from "next/link";
import { askVioletAction, type VioletSource } from "@/lib/actions/violet";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

interface Msg {
  role: "user" | "model";
  text: string;
  sources?: VioletSource[];
  failed?: boolean;
}

const SUGGESTIONS = [
  "Apa itu Ormawa Visit?",
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
  const listRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  // Keep the newest turn in view as the answer arrives.
  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, pending]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || pending) return;
    setInput("");
    // Only completed exchanges become history; a failed turn would poison the
    // follow-up context with an error message.
    const history = msgs
      .filter((m) => !m.failed)
      .map((m) => ({ role: m.role, text: m.text }));
    setMsgs((prev) => [...prev, { role: "user", text: q }]);
    setPending(true);
    const res = await askVioletAction(q, history);
    setPending(false);
    setMsgs((prev) => [
      ...prev,
      res.ok
        ? { role: "model", text: res.answer, sources: res.sources }
        : { role: "model", text: res.error, failed: true },
    ]);
    inputRef.current?.focus();
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label={t("Buka Violet")}
          className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
        >
          <Sparkles className="size-4" /> Violet
        </button>
      )}

      {open && (
        <div className="fixed inset-x-3 bottom-3 z-40 flex max-h-[80dvh] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:inset-x-auto sm:right-4 sm:w-[400px]">
          <div className="flex items-center gap-2 border-b border-border bg-violet-600 px-4 py-3 text-white">
            <Sparkles className="size-4" />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-sm font-semibold">Violet</p>
              <p className="truncate text-[11px] text-white/80">{t("Asisten Ormawa Visit Management System")}</p>
            </div>
            {msgs.length > 0 && (
              <button
                onClick={() => setMsgs([])}
                aria-label={t("Bersihkan percakapan")}
                className="rounded-lg p-1.5 transition hover:bg-white/15"
              >
                <Trash2 className="size-4" />
              </button>
            )}
            <button onClick={() => setOpen(false)} aria-label={t("Tutup")} className="rounded-lg p-1.5 transition hover:bg-white/15">
              <X className="size-4" />
            </button>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-3">
            {msgs.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {t("Halo! Aku Violet. Aku hanya menjawab seputar sistem ini: menu, cara pakai, hak akses, dan datanya.")}
                </p>
                <div className="flex flex-col gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => ask(s)}
                      className="rounded-lg border border-border px-3 py-2 text-left text-xs transition hover:bg-muted"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {msgs.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm",
                    m.role === "user"
                      ? "bg-violet-600 text-white"
                      : m.failed
                        ? "bg-danger/10 text-danger"
                        : "bg-muted text-foreground",
                  )}
                >
                  {m.text}
                  {!!m.sources?.length && (
                    <div className="mt-2 flex flex-wrap gap-1 border-t border-border/60 pt-2">
                      {m.sources.map((s, j) =>
                        s.href ? (
                          <Link
                            key={j}
                            href={s.href}
                            onClick={() => setOpen(false)}
                            className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 text-[10px] text-muted-foreground transition hover:text-foreground"
                          >
                            {s.source} <ExternalLink className="size-2.5" />
                          </Link>
                        ) : (
                          <span key={j} className="rounded-full bg-card px-2 py-0.5 text-[10px] text-muted-foreground">
                            {s.source}
                          </span>
                        ),
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {pending && (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" /> {t("Violet sedang mengetik…")}
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); ask(input); }}
            className="flex items-end gap-2 border-t border-border p-2"
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
              className="max-h-24 min-h-[38px] flex-1 resize-none rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none transition focus:border-primary"
            />
            <button
              type="submit"
              disabled={pending || !input.trim()}
              aria-label={t("Kirim")}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white transition hover:bg-violet-700 disabled:opacity-50"
            >
              <Send className="size-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
