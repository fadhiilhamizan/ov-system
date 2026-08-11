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
import { Textarea } from "@/components/ui/textarea";
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
import { MemberPicker } from "@/components/members/member-picker";
import { useT } from "@/lib/i18n/provider";
import { useResetOn } from "@/lib/use-synced";
import type { Member, Prospect } from "@/lib/types";

const CONTACT = ["none", "MENGHUBUNGI", "DIHUBUNGI"];
const THEIRS = ["none", "DITUNGGU", "DITERIMA", "DITOLAK"];
const OURS = ["none", "TUNGGU", "TERIMA", "TOLAK"];
const PROSPECT_MODE = "__unset__";

export function ProspectFormDialog({
  mode,
  prospect,
  members,
  eventId,
  open,
  onOpenChange,
  trigger,
}: {
  mode: "create" | "edit";
  prospect?: Prospect;
  members: Member[];
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

  const [f, setF] = useResetOn(`${isOpen}:${prospect?.id ?? "new"}`, () => ({
    org_name: prospect?.org_name ?? "",
    campus: prospect?.campus ?? "",
    contact: prospect?.contact ?? "",
    pic: prospect?.pic ?? "",
    location: prospect?.location ?? "",
    prospectMode: prospect?.mode || PROSPECT_MODE,
    contact_status: prospect?.contact_status || "none",
    their_response: prospect?.their_response || "none",
    our_response: prospect?.our_response || "none",
    done: prospect?.done ?? false,
    link: prospect?.link ?? "",
    link_label: prospect?.link_label ?? "",
    notes: prospect?.notes ?? "",
    link_in_super_link: prospect?.link_in_super_link ?? false,
  }));


  function submit() {
    start(async () => {
      const { prospectMode, ...rest } = f;
      const payload = {
        ...rest,
        event_id: prospect?.event_id ?? eventId,
        mode: prospectMode === PROSPECT_MODE ? "" : prospectMode,
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>{t("Nama Ormawa / Himpunan")}</Label>
              <Input value={f.org_name} onChange={(e) => setF({ ...f, org_name: e.target.value })} placeholder="HMTI, KBMDSI…" />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Asal Kampus")}</Label>
              <Input value={f.campus} onChange={(e) => setF({ ...f, campus: e.target.value })} placeholder="ITB, UB, ITS…" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>{t("Kontak")}</Label>
              <Input value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} placeholder={t("No. WA / IG / email")} />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("PIC (dari kita)")}</Label>
              <MemberPicker
                members={members}
                value={f.pic}
                onChange={(v) => setF({ ...f, pic: v })}
                placeholder={t("Pilih anggota EA")}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>{t("Lokasi")}</Label>
              <Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="Gedung / kota…" />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Mode")}</Label>
              <Select value={f.prospectMode} onValueChange={(v) => setF({ ...f, prospectMode: v })}>
                <SelectTrigger><SelectValue placeholder={t("Belum ditentukan")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={PROSPECT_MODE}>{t("Belum ditentukan")}</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FieldSelect label={t("Status Hubungi")} value={f.contact_status} options={CONTACT} onChange={(v) => setF({ ...f, contact_status: v })} />
            <FieldSelect label={t("Respons Mereka")} value={f.their_response} options={THEIRS} onChange={(v) => setF({ ...f, their_response: v })} />
            <FieldSelect label={t("Respons Kita")} value={f.our_response} options={OURS} onChange={(v) => setF({ ...f, our_response: v })} />
          </div>

          <div className="grid gap-1.5">
            <Label>{t("Tautan (opsional)")}</Label>
            <Input
              value={f.link}
              onChange={(e) => setF({ ...f, link: e.target.value })}
              placeholder="https://drive.google.com/..."
              inputMode="url"
            />
            <p className="text-[11px] text-muted-foreground">
              {t("Misalnya handbook, profil organisasi, atau proposal dari himpunan tersebut.")}
            </p>
          </div>

          {/* Same deal as a task result link: name it, then tick to publish. */}
          {f.link.trim() !== "" && (
            <div className="grid gap-2 rounded-lg border border-border bg-muted/30 p-3">
              <div className="grid gap-1.5">
                <Label>{t("Nama tautan")}</Label>
                <Input
                  value={f.link_label}
                  onChange={(e) => setF({ ...f, link_label: e.target.value })}
                  placeholder={f.org_name || t("Handbook himpunan")}
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={f.link_in_super_link}
                  onCheckedChange={(v) => setF({ ...f, link_in_super_link: !!v })}
                />
                {t("Tampilkan juga di Super Link")}
              </label>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label>{t("Catatan (opsional)")}</Label>
            <Textarea
              value={f.notes}
              onChange={(e) => setF({ ...f, notes: e.target.value })}
              className="min-h-[70px]"
              placeholder={t("Catatan bebas tentang prospek ini.")}
            />
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
