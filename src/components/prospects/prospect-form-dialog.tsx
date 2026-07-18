"use client";
import * as React from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createProspectAction, updateProspectAction } from "@/lib/actions/prospects";
import { useT } from "@/lib/i18n/provider";
import type { Prospect } from "@/lib/types";

const CONTACT = ["none", "MENGHUBUNGI", "DIHUBUNGI"];
const THEIRS = ["none", "DITUNGGU", "DITERIMA", "DITOLAK"];
const OURS = ["none", "TUNGGU", "TERIMA", "TOLAK"];

export function ProspectFormDialog({
  mode,
  prospect,
  batches,
  eventId,
  open,
  onOpenChange,
  trigger,
}: {
  mode: "create" | "edit";
  prospect?: Prospect;
  batches: string[];
  eventId: string;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  trigger?: React.ReactNode;
}) {
  const t = useT();
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isOpen = open ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [pending, start] = React.useTransition();

  const [f, setF] = React.useState(() => ({
    batch: prospect?.batch ?? batches[0] ?? "Prospek Baru",
    org_name: prospect?.org_name ?? "",
    campus: prospect?.campus ?? "",
    contact: prospect?.contact ?? "",
    pic: prospect?.pic ?? "",
    location: prospect?.location ?? "",
    contact_status: prospect?.contact_status || "none",
    their_response: prospect?.their_response || "none",
    our_response: prospect?.our_response || "none",
    done: prospect?.done ?? false,
  }));

  React.useEffect(() => {
    if (isOpen && prospect) {
      setF({
        batch: prospect.batch,
        org_name: prospect.org_name,
        campus: prospect.campus,
        contact: prospect.contact,
        pic: prospect.pic,
        location: prospect.location,
        contact_status: prospect.contact_status || "none",
        their_response: prospect.their_response || "none",
        our_response: prospect.our_response || "none",
        done: prospect.done,
      });
    }
  }, [isOpen, prospect]);

  function submit() {
    start(async () => {
      const payload = {
        ...f,
        event_id: prospect?.event_id ?? eventId,
        contact_status: f.contact_status === "none" ? "" : f.contact_status,
        their_response: f.their_response === "none" ? "" : f.their_response,
        our_response: f.our_response === "none" ? "" : f.our_response,
      };
      const res =
        mode === "create"
          ? await createProspectAction(payload)
          : await updateProspectAction(prospect!.id, payload);
      if (res.ok) {
        toast.success(mode === "create" ? t("Prospek ditambahkan") : t("Prospek diperbarui"));
        setOpen(false);
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger}
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? t("Tambah Prospek") : t("Edit Prospek")}</DialogTitle>
          <DialogDescription>{t("Data himpunan target kunjungan Ormawa Visit.")}</DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[65vh] gap-4 overflow-y-auto px-0.5 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("Nama Ormawa / Himpunan")}</Label>
              <Input value={f.org_name} onChange={(e) => setF({ ...f, org_name: e.target.value })} placeholder="HMTI, KBMDSI…" />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Asal Kampus")}</Label>
              <Input value={f.campus} onChange={(e) => setF({ ...f, campus: e.target.value })} placeholder="ITB, UB, ITS…" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("Kontak")}</Label>
              <Input value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} placeholder={t("No. WA / IG / email")} />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("PIC (dari kita)")}</Label>
              <Input value={f.pic} onChange={(e) => setF({ ...f, pic: e.target.value })} placeholder={t("Nama PIC")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("Batch / Kampanye")}</Label>
              <Input value={f.batch} onChange={(e) => setF({ ...f, batch: e.target.value })} list="batches" />
              <datalist id="batches">
                {batches.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Lokasi / Mode")}</Label>
              <Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder={t("Offline / Online")} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <FieldSelect label={t("Status Hubungi")} value={f.contact_status} options={CONTACT} onChange={(v) => setF({ ...f, contact_status: v })} />
            <FieldSelect label={t("Respons Mereka")} value={f.their_response} options={THEIRS} onChange={(v) => setF({ ...f, their_response: v })} />
            <FieldSelect label={t("Respons Kita")} value={f.our_response} options={OURS} onChange={(v) => setF({ ...f, our_response: v })} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={f.done} onCheckedChange={(v) => setF({ ...f, done: !!v })} />
            {t("Tandai selesai / terkonfirmasi")}
          </label>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t("Batal")}</Button>
          </DialogClose>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {mode === "create" ? t("Tambah") : t("Simpan")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o === "none" ? "-" : o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
