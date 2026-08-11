"use client";
import * as React from "react";
import { toast } from "sonner";
import { Loader2, Search, UserPlus } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty";
import { setMembersDivisionAction } from "@/lib/actions/manage";
import { memberDivisions, memberInDivision, memberLabel } from "@/lib/members";
import { useT } from "@/lib/i18n/provider";
import { useResetOn } from "@/lib/use-synced";
import { visibleSelection } from "@/lib/use-multi-select";
import type { Division, Member } from "@/lib/types";

/**
 * Put people who are ALREADY on the roster into this division.
 *
 * Deliberately not the "new member" form: someone who is in Event and also
 * helps Konsumsi is one person in two divisions, not two records. Adding here
 * APPENDS the division, so whatever else they belong to is left alone and
 * their primary division does not change (see `withDivisionAdded`).
 */
export function AddMembersToDivisionDialog({
  division, members, divisions,
}: {
  division: Division;
  /** The whole roster for this Ormawa Visit. */
  members: Member[];
  /** Used only to show which other divisions a person is already in. */
  divisions: Division[];
}) {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const [q, setQ] = useResetOn(open, () => "");
  const [picked, setPicked] = useResetOn(open, () => new Set<string>());

  const divName = React.useMemo(
    () => new Map(divisions.map((d) => [d.key, d])),
    [divisions],
  );

  // Only people not already in this division: listing the rest would just be
  // rows you cannot act on.
  const candidates = React.useMemo(
    () => members.filter((m) => !memberInDivision(m, division.key)),
    [members, division.key],
  );

  const shown = React.useMemo(() => {
    const query = q.toLowerCase().trim();
    if (!query) return candidates;
    return candidates.filter((m) =>
      `${m.name} ${m.nickname} ${m.nrp}`.toLowerCase().includes(query));
  }, [candidates, q]);

  const shownIds = shown.map((m) => m.id);
  const pickedInView = visibleSelection(picked, shownIds);
  const allShownPicked = shown.length > 0 && pickedInView.length === shown.length;

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  /** Select-all touches only the rows the search is showing, so a tick made
   *  before searching is not thrown away. */
  function toggleAllShown() {
    setPicked((prev) => {
      const next = new Set(prev);
      for (const id of shownIds) { if (allShownPicked) next.delete(id); else next.add(id); }
      return next;
    });
  }

  function submit() {
    const ids = [...picked];
    start(async () => {
      const res = await setMembersDivisionAction(ids, division.key, true);
      if (res.ok) {
        toast.success(`${ids.length} ${t("anggota ditambahkan ke")} ${division.name}`);
        setOpen(false);
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-primary transition hover:bg-muted"
      >
        <UserPlus className="size-3" /> {t("Tambah anggota")}
      </button>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Tambah anggota ke")} {division.name}</DialogTitle>
          <DialogDescription>
            {t("Pilih anggota yang sudah terdaftar. Divisi lain yang mereka ikuti tidak akan hilang.")}
          </DialogDescription>
        </DialogHeader>

        {candidates.length === 0 ? (
          <EmptyState
            icon={<UserPlus />}
            title={t("Semua anggota sudah masuk divisi ini")}
            description={t("Tambahkan orang baru lewat tab Anggota EA kalau memang belum terdaftar.")}
          />
        ) : (
          <div className="grid gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("Cari nama / NRP…")}
                className="pl-9"
              />
            </div>

            {shown.length > 0 && (
              <label className="flex cursor-pointer items-center gap-2 border-b border-border pb-2 text-xs text-muted-foreground">
                <Checkbox checked={allShownPicked} onCheckedChange={toggleAllShown} />
                {t("Pilih semua yang tampil")} ({shown.length})
              </label>
            )}

            <div className="max-h-64 space-y-0.5 overflow-y-auto">
              {shown.map((m) => {
                const others = memberDivisions(m);
                return (
                  <label
                    key={m.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition hover:bg-muted"
                  >
                    <Checkbox checked={picked.has(m.id)} onCheckedChange={() => toggle(m.id)} />
                    <Avatar name={memberLabel(m)} size={22} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{m.name}</span>
                      {others.length > 0 && (
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {others.map((k) => divName.get(k)?.short ?? k).join(", ")}
                        </span>
                      )}
                    </span>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {m.type === "intern" ? "Intern" : t("Fungsionaris")}
                    </Badge>
                  </label>
                );
              })}
              {shown.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {t("Tidak ada anggota yang cocok.")}
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild><Button variant="outline">{t("Batal")}</Button></DialogClose>
          <Button onClick={submit} disabled={pending || picked.size === 0}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {t("Tambahkan")} {picked.size > 0 ? picked.size : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
