import Link from "next/link";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { Card } from "@/components/ui/card";
import { pick } from "@/lib/guide";
import { LEGAL_CONTACT_EMAIL, LEGAL_CONTACT_WA, LEGAL_UPDATED, type LegalDoc } from "@/lib/legal";
import { formatDate } from "@/lib/format";
import type { Lang } from "@/lib/i18n/config";

/**
 * Renders a legal document (Privacy Policy / Terms of Service).
 *
 * These pages sit OUTSIDE the (app) route group on purpose: someone must be
 * able to read them before they have an account, so they carry their own
 * minimal chrome instead of the AppShell.
 */
export function LegalDocument({ doc, lang }: { doc: LegalDoc; lang: Lang }) {
  const L = {
    back: lang === "en" ? "Back to sign in" : "Kembali ke halaman masuk",
    updated: lang === "en" ? "Last updated" : "Terakhir diperbarui",
    contact: lang === "en" ? "Contact us on WhatsApp" : "Hubungi kami via WhatsApp",
    other: lang === "en"
      ? (doc.slug === "privacy" ? "Terms of Service" : "Privacy Policy")
      : (doc.slug === "privacy" ? "Ketentuan Layanan" : "Kebijakan Privasi"),
    otherHref: doc.slug === "privacy" ? "/terms" : "/privacy",
  };

  return (
    <div className="min-h-dvh bg-muted/30">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4 sm:px-6">
          <Logo size={32} />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-bold">Ormawa Visit Management System</p>
            <p className="truncate text-xs text-muted-foreground">External Affairs HMSI ITS</p>
          </div>
          <Link
            href="/login"
            className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-muted"
          >
            <ArrowLeft className="size-3.5" /> <span className="hidden sm:inline">{L.back}</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{pick(doc.title, lang)}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {L.updated}: {formatDate(LEGAL_UPDATED, { long: true })}
        </p>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{pick(doc.summary, lang)}</p>

        <div className="mt-8 space-y-7">
          {doc.sections.map((s, i) => (
            <section key={i} className="space-y-2.5">
              <h2 className="text-base font-semibold">{pick(s.heading, lang)}</h2>
              {s.body?.map((p, j) => (
                <p key={j} className="text-sm leading-relaxed text-muted-foreground">
                  {pick(p, lang)}
                </p>
              ))}
              {s.bullets && (
                <ul className="space-y-1.5">
                  {s.bullets.map((b, j) => (
                    <li key={j} className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground">
                      <span className="mt-2 size-1 shrink-0 rounded-full bg-primary" />
                      <span>{pick(b, lang)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <Card className="mt-8 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            <p className="font-medium">
              {lang === "en" ? "Questions about this document?" : "Ada pertanyaan soal dokumen ini?"}
            </p>
            {LEGAL_CONTACT_EMAIL && (
              <p className="text-muted-foreground">{LEGAL_CONTACT_EMAIL}</p>
            )}
          </div>
          <a
            href={LEGAL_CONTACT_WA}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:brightness-105"
          >
            <MessageCircle className="size-4" /> {L.contact}
          </a>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link href={L.otherHref} className="font-medium text-primary hover:underline">
            {L.other}
          </Link>
        </p>
      </main>
    </div>
  );
}
