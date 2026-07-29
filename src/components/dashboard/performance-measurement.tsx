import { Star, Users, MessageSquare, FileText, ExternalLink, Gauge } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { OVEvent } from "@/lib/types";

/** Five stars with the score filled proportionally (4.78 → 4¾ stars lit). */
function StarRating({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => {
        // Portion of THIS star that should be filled, 0–1.
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <span key={i} className="relative inline-block size-3.5 shrink-0">
            <Star className="absolute inset-0 size-3.5 text-muted-foreground/30" />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className="size-3.5 fill-amber-400 text-amber-400" />
            </span>
          </span>
        );
      })}
    </span>
  );
}

function Metric({
  icon,
  label,
  value,
  sub,
  empty,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  empty?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border p-3.5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="[&_svg]:size-3.5">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className={cn("mt-1.5 text-xl font-bold tabular-nums", empty && "text-muted-foreground/50")}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

/**
 * The after-the-event numbers for one Ormawa Visit.
 *
 * Every field is optional. A null renders as "—", deliberately NOT as 0: "no
 * feedback yet" and "zero people rated it" are different facts, and a committee
 * reading this card should not have to guess which one it is looking at.
 */
export function PerformanceMeasurement({
  event,
  t,
}: {
  event: OVEvent;
  t: (s: string) => string;
}) {
  const partner = event.partner?.trim() || t("himpunan partner");
  const num = (v: number | null | undefined) =>
    v === null || v === undefined ? "—" : v.toLocaleString("id-ID");
  const rating = (v: number | null | undefined) =>
    v === null || v === undefined ? null : Math.max(0, Math.min(5, v));

  const hmsiRating = rating(event.feedback_hmsi_rating);
  const partnerRating = rating(event.feedback_partner_rating);

  const anyFilled =
    [
      event.attendance_hmsi,
      event.feedback_hmsi_count,
      event.feedback_hmsi_rating,
      event.feedback_partner_count,
      event.feedback_partner_rating,
    ].some((v) => v !== null && v !== undefined) || !!event.report_url;

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2">
        <Gauge className="size-4 text-primary" />
        <CardTitle>{t("Performance Measurement")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!anyFilled && (
          <p className="text-xs text-muted-foreground">
            {t("Belum diisi. Buka menu Ormawa Visit → Edit untuk mengisi hasil pengukuran setelah acara.")}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Metric
            icon={<Users />}
            label={t("Fungsionaris HMSI hadir")}
            value={num(event.attendance_hmsi)}
            sub={t("orang")}
            empty={event.attendance_hmsi == null}
          />
          <Metric
            icon={<MessageSquare />}
            label={t("Feedback dari HMSI")}
            value={num(event.feedback_hmsi_count)}
            sub={t("tanggapan")}
            empty={event.feedback_hmsi_count == null}
          />
          <Metric
            icon={<Star />}
            label={t("Rata-rata rating HMSI")}
            value={
              hmsiRating === null ? (
                "—"
              ) : (
                <span className="flex items-center gap-2">
                  {hmsiRating.toFixed(2)}<span className="text-xs font-normal text-muted-foreground">/5.0</span>
                  <StarRating value={hmsiRating} />
                </span>
              )
            }
            empty={hmsiRating === null}
          />
          <Metric
            icon={<MessageSquare />}
            label={`${t("Feedback dari")} ${partner}`}
            value={num(event.feedback_partner_count)}
            sub={t("tanggapan")}
            empty={event.feedback_partner_count == null}
          />
          <Metric
            icon={<Star />}
            label={`${t("Rata-rata rating")} ${partner}`}
            value={
              partnerRating === null ? (
                "—"
              ) : (
                <span className="flex items-center gap-2">
                  {partnerRating.toFixed(2)}<span className="text-xs font-normal text-muted-foreground">/5.0</span>
                  <StarRating value={partnerRating} />
                </span>
              )
            }
            empty={partnerRating === null}
          />
          <div className="rounded-xl border border-border p-3.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileText className="size-3.5" />
              <span className="truncate">{t("Pertanggung Jawaban")}</span>
            </div>
            {event.report_url ? (
              <a
                href={event.report_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
              >
                {t("Buka LPJ")} <ExternalLink className="size-3.5" />
              </a>
            ) : (
              <div className="mt-1.5 text-xl font-bold text-muted-foreground/50">—</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
