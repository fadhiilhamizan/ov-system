import { Lightbulb, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { GUIDE, pick } from "@/lib/guide";
import type { Lang } from "@/lib/i18n/config";

/**
 * Detailed per-feature usage guide. Content lives in src/lib/guide.ts with
 * Indonesian + English side by side, so it follows the language toggle.
 */
export function GuideSections({ lang }: { lang: Lang }) {
  const L = {
    steps: lang === "en" ? "How to use" : "Cara pakai",
    tips: lang === "en" ? "Worth knowing" : "Perlu diketahui",
    access: lang === "en" ? "Who can use it" : "Siapa yang bisa",
  };

  return (
    <div className="space-y-4">
      {GUIDE.map((s, i) => (
        <Card key={s.key} className="overflow-hidden">
          <details open={i === 0} className="group">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 transition hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-semibold">{pick(s.title, lang)}</h3>
                <p className="truncate text-xs text-muted-foreground">{pick(s.purpose, lang)}</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground transition group-open:rotate-180">▾</span>
            </summary>

            <div className="space-y-4 border-t border-border px-5 py-4">
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {L.steps}
                </p>
                <ol className="space-y-1.5">
                  {s.steps.map((st, j) => (
                    <li key={j} className="flex gap-2.5 text-sm">
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold tabular-nums text-muted-foreground">
                        {j + 1}
                      </span>
                      <span className="text-muted-foreground">{pick(st, lang)}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {s.tips && s.tips.length > 0 && (
                <div className="rounded-lg border border-amber-300/50 bg-amber-50/50 p-3 dark:border-amber-500/25 dark:bg-amber-500/10">
                  <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                    <Lightbulb className="size-3.5" /> {L.tips}
                  </p>
                  <ul className="space-y-1">
                    {s.tips.map((tip, j) => (
                      <li key={j} className="flex gap-2 text-sm text-muted-foreground">
                        <span className="text-amber-600 dark:text-amber-400">•</span>
                        {pick(tip, lang)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {s.access && (
                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                  <span>
                    <span className="font-medium text-foreground">{L.access}: </span>
                    {pick(s.access, lang)}
                  </span>
                </p>
              )}
            </div>
          </details>
        </Card>
      ))}
    </div>
  );
}
