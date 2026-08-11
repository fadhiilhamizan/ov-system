"use client";
import { Lock } from "lucide-react";
import { useT } from "@/lib/i18n/provider";

/**
 * Full-width strip shown while the active Ormawa Visit is archived.
 *
 * Deliberately slate, not amber: amber already means "you are in the demo
 * sandbox", and the two states are unrelated - a production edition can be
 * archived, and the demo edition can be open. Two banners can legitimately
 * stack, so they must be tellable apart at a glance.
 */
export function ArchiveBanner({ isAdmin }: { isAdmin: boolean }) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 bg-slate-600 px-4 py-1.5 text-center text-xs font-medium text-white dark:bg-slate-700">
      <Lock className="size-3.5 shrink-0" />
      <span>
        {isAdmin
          ? t("Ormawa Visit ini diarsipkan - hanya kamu (admin) yang masih bisa mengubah isinya. Buka kunci dari menu Daftar Ormawa Visit.")
          : t("Ormawa Visit ini diarsipkan - isinya hanya bisa dilihat. Minta admin membuka kuncinya untuk mengubah data.")}
      </span>
    </div>
  );
}
