"use client";
import * as React from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, MoreHorizontal } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger,
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { createFaqAction, updateFaqAction, deleteFaqAction } from "@/lib/actions/faq";
import { useT } from "@/lib/i18n/provider";
import type { Faq } from "@/lib/types";

function FaqFormDialog({
  mode, faq, open, onOpenChange, trigger,
}: {
  mode: "create" | "edit";
  faq?: Faq;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  trigger?: React.ReactNode;
}) {
  const t = useT();
  const [io, setIo] = React.useState(false);
  const isOpen = open ?? io;
  const setOpen = onOpenChange ?? setIo;
  const [pending, start] = React.useTransition();
  const [f, setF] = React.useState(() => ({ question: faq?.question ?? "", answer: faq?.answer ?? "" }));
  React.useEffect(() => {
    if (isOpen && faq) setF({ question: faq.question, answer: faq.answer });
  }, [isOpen, faq]);

  function submit() {
    start(async () => {
      const res = mode === "create" ? await createFaqAction(f) : await updateFaqAction(faq!.id, f);
      if (res.ok) { toast.success(mode === "create" ? t("FAQ ditambahkan") : t("FAQ diperbarui")); setOpen(false); }
      else toast.error(res.error);
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger}
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? t("Tambah FAQ") : t("Edit FAQ")}</DialogTitle>
          <DialogDescription>{t("Pertanyaan yang sering diajukan seputar Ormawa Visit.")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>{t("Pertanyaan")} <span className="text-danger">*</span></Label>
            <Input value={f.question} onChange={(e) => setF({ ...f, question: e.target.value })} placeholder={t("Apa itu Ormawa Visit?")} />
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Jawaban")} <span className="text-danger">*</span></Label>
            <Textarea value={f.answer} onChange={(e) => setF({ ...f, answer: e.target.value })} className="min-h-[120px]" />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">{t("Batal")}</Button></DialogClose>
          <Button onClick={submit} disabled={pending || !f.question.trim() || !f.answer.trim()}>
            {pending && <Loader2 className="size-4 animate-spin" />}{mode === "create" ? t("Tambah") : t("Simpan")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AddFaqButton() {
  const t = useT();
  return (
    <FaqFormDialog mode="create" trigger={
      <DialogTrigger asChild><Button><Plus className="size-4" /> {t("Tambah FAQ")}</Button></DialogTrigger>
    } />
  );
}

export function FaqActions({ faq }: { faq: Faq }) {
  const t = useT();
  const [editOpen, setEditOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          onClick={(e) => e.preventDefault()}
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none"
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}><Pencil /> {t("Edit")}</DropdownMenuItem>
          <DropdownMenuItem destructive onSelect={() => start(async () => {
            const res = await deleteFaqAction(faq.id);
            if (res.ok) toast.success(t("FAQ dihapus")); else toast.error(res.error);
          })}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 />} {t("Hapus")}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <FaqFormDialog mode="edit" faq={faq} open={editOpen} onOpenChange={setEditOpen} />
    </>
  );
}
