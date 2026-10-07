"use client";
import * as React from "react";
import { usePathname } from "next/navigation";
import { Share2, Copy, Check, ExternalLink, Eye } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ALL_NAV_ITEMS } from "@/components/layout/nav-config";
import { useT } from "@/lib/i18n/provider";
import { SHAREABLE_MODULES, shareModuleForPath, shareUrl, type ShareModule } from "@/lib/share";
import type { OVEvent } from "@/lib/types";

/**
 * "Bagikan": a link that opens this menu, in this Ormawa Visit, read-only, for
 * someone without an account (see lib/share.ts). Shown in the topbar only on
 * menus that can be shared.
 */
export function ShareButton({
  events, activeEventId, demo,
}: {
  events: OVEvent[];
  activeEventId: string;
  /** The app is in demo mode: the link must open the demo database too. */
  demo: boolean;
}) {
  const t = useT();
  const pathname = usePathname();
  const current = shareModuleForPath(pathname);
  const [open, setOpen] = React.useState(false);
  const [eventId, setEventId] = React.useState(activeEventId);
  const [module, setModule] = React.useState<ShareModule>(current ?? "dashboard");
  const [keepView, setKeepView] = React.useState(true);
  const [copied, setCopied] = React.useState(false);
  const [query, setQuery] = React.useState<Record<string, string>>({});

  if (!current) return null;

  function openDialog() {
    setEventId(activeEventId);
    setModule(current!);
    setCopied(false);
    // The calendar keeps its view and date in the URL; carry them along.
    const sp = new URLSearchParams(window.location.search);
    const q: Record<string, string> = {};
    for (const k of ["view", "date"]) { const v = sp.get(k); if (v) q[k] = v; }
    setQuery(q);
    setOpen(true);
  }

  const carry = module === current && Object.keys(query).length > 0;
  const url = typeof window === "undefined"
    ? ""
    : shareUrl(window.location.origin, eventId, module, { demo, query: carry && keepView ? query : undefined });
  const label = (k: ShareModule) => t(ALL_NAV_ITEMS.find((i) => i.key === k)?.label ?? k);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(t("Tautan disalin"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("Tidak bisa menyalin otomatis. Salin tautannya secara manual."));
    }
  }
  async function nativeShare() {
    try {
      await navigator.share({ title: `${label(module)} - Ormawa Visit`, url });
    } catch {
      /* dismissed */
    }
  }
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={openDialog}
        aria-label={t("Bagikan halaman ini")}
        title={t("Bagikan halaman ini")}
        data-command={t("Bagikan halaman ini")}
      >
        <Share2 />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Share2 className="size-5" /> {t("Bagikan tautan")}</DialogTitle>
            <DialogDescription>
              {t("Siapa pun yang membuka tautan ini langsung melihat menu yang dipilih sebagai Tamu (hanya baca), tanpa perlu login.")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>{t("Ormawa Visit")}</Label>
              <Select value={eventId} onValueChange={setEventId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {events.map((e) => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Menu")}</Label>
              <Select value={module} onValueChange={(v) => setModule(v as ShareModule)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SHAREABLE_MODULES.map((m) => <SelectItem key={m} value={m}>{label(m)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {carry && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={keepView} onCheckedChange={(c) => setKeepView(c === true)} />
              {t("Sertakan tampilan dan tanggal kalender yang sedang dibuka")}
            </label>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="share-url">{t("Tautan")}</Label>
            <div className="flex gap-2">
              <Input id="share-url" readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
              <Button type="button" variant="outline" onClick={copy} aria-label={t("Salin tautan")}>
                {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
                <span className="hidden sm:inline">{copied ? t("Disalin") : t("Salin")}</span>
              </Button>
            </div>
          </div>

          <p className="flex gap-2 rounded-lg border border-border bg-muted/40 p-2.5 text-xs text-muted-foreground">
            <Eye className="mt-0.5 size-3.5 shrink-0" />
            {t("Tamu tidak bisa mengubah data apa pun, dan tidak bisa melihat daftar anggota, anggaran, maupun Super Link. Bagikan hanya ke orang yang memang boleh melihat isi menu ini.")}
          </p>

          <DialogFooter>
            <DialogClose asChild><Button variant="outline">{t("Tutup")}</Button></DialogClose>
            <Button variant="outline" asChild>
              <a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-4" /> {t("Coba buka")}</a>
            </Button>
            {canNativeShare ? (
              <Button onClick={nativeShare}><Share2 className="size-4" /> {t("Bagikan")}</Button>
            ) : (
              <Button onClick={copy}><Copy className="size-4" /> {t("Salin tautan")}</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
