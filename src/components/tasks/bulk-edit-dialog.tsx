"use client";
import * as React from "react";
import { toast } from "sonner";
import { Loader2, PencilLine } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { MemberPicker } from "@/components/members/member-picker";
import { useMembers } from "@/components/members/members-context";
import { memberInDivision } from "@/lib/members";
import { bulkUpdateTaskFieldsAction } from "@/lib/actions/tasks";
import { useT } from "@/lib/i18n/provider";
import { useResetOn } from "@/lib/use-synced";
import type { Division, DivisionKey } from "@/lib/types";

/**
 * Edit Divisi / PIC / Deadline across every selected task in one go.
 *
 * Each field has its own checkbox and only the TICKED ones are sent. That is
 * the whole point: a bulk write touches rows the user never opened, so an
 * untouched field must never be overwritten with an empty default — this is
 * what separates it from opening one task's form.
 */
export function BulkEditDialog({
  ids, divisions, onDone,
}: {
  ids: string[];
  divisions: Division[];
  /** Clear the selection once the write lands. */
  onDone: () => void;
}) {
  const t = useT();
  const members = useMembers();
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();

  // Every re-open starts blank so a previous edit can't be replayed by accident.
  const [f, setF] = useResetOn(open, () => ({
    useDivision: false, division: (divisions[0]?.key ?? "") as DivisionKey,
    usePic: false, pic: "",
    useDeadline: false, end_date: "",
  }));

  // PIC choices follow the division being applied; without a division change we
  // cannot know which roster to narrow to, so all members stay available.
  const picMembers = React.useMemo(
    () => (f.useDivision && f.division ? members.filter((m) => memberInDivision(m, f.division)) : members),
    [members, f.useDivision, f.division],
  );

  const nothingPicked = !f.useDivision && !f.usePic && !f.useDeadline;

  function submit() {
    start(async () => {
      const res = await bulkUpdateTaskFieldsAction(ids, {
        ...(f.useDivision ? { division: f.division } : {}),
        ...(f.usePic ? { pic: f.pic } : {}),
        // An empty date field means "clear the deadline", which is a deliberate
        // edit — hence null rather than skipping the key.
        ...(f.useDeadline ? { end_date: f.end_date || null } : {}),
      });
      if (res.ok) {
        toast.success(`${res.count} ${t("tugas diperbarui")}`);
        if (res.skipped > 0) toast.warning(`${res.skipped} ${t("tugas dilewati (tanpa akses)")}`);
        setOpen(false);
        onDone();
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        onClick={() => setOpen(true)}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium transition hover:bg-muted disabled:opacity-60"
      >
        <PencilLine className="size-3.5" /> {t("Ubah massal")}
      </button>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Ubah massal")}</DialogTitle>
          <DialogDescription>
            {ids.length} {t("tugas terpilih. Centang kolom yang ingin diubah — kolom yang tidak dicentang dibiarkan apa adanya.")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <Checkbox checked={f.useDivision} onCheckedChange={(v) => setF({ ...f, useDivision: v === true })} />
              {t("Divisi")}
            </label>
            <Select
              value={f.division}
              onValueChange={(v) => setF({ ...f, division: v as DivisionKey, useDivision: true })}
            >
              <SelectTrigger disabled={!f.useDivision}><SelectValue /></SelectTrigger>
              <SelectContent>
                {divisions.map((d) => <SelectItem key={d.key} value={d.key}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <Checkbox checked={f.usePic} onCheckedChange={(v) => setF({ ...f, usePic: v === true })} />
              {t("PIC / Penanggung Jawab")}
            </label>
            <div className={!f.usePic ? "pointer-events-none opacity-50" : undefined}>
              <MemberPicker
                members={picMembers}
                value={f.pic}
                onChange={(v) => setF({ ...f, pic: v })}
                placeholder={t("Pilih dari anggota")}
              />
            </div>
            {f.usePic && !f.pic && (
              <p className="text-xs text-muted-foreground">{t("Dibiarkan kosong = PIC dikosongkan.")}</p>
            )}
          </div>

          <div className="grid gap-1.5">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <Checkbox checked={f.useDeadline} onCheckedChange={(v) => setF({ ...f, useDeadline: v === true })} />
              {t("Deadline")}
            </label>
            <Input
              type="date"
              value={f.end_date}
              disabled={!f.useDeadline}
              onChange={(e) => setF({ ...f, end_date: e.target.value })}
            />
            {f.useDeadline && !f.end_date && (
              <p className="text-xs text-muted-foreground">{t("Dibiarkan kosong = deadline dihapus.")}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild><Button variant="outline">{t("Batal")}</Button></DialogClose>
          <Button onClick={submit} disabled={pending || nothingPicked}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {t("Terapkan ke")} {ids.length} {t("tugas")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
