"use client";
import * as React from "react";
import { toast } from "sonner";
import { RotateCcw, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger,
} from "@/components/ui/dialog";
import { resetDemoDataAction } from "@/lib/actions/demo";
import { useT } from "@/lib/i18n/provider";

export function DemoReset() {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();

  function reset() {
    start(async () => {
      const res = await resetDemoDataAction();
      if (res.ok) { toast.success(t("Data demo dikembalikan ke awal.")); setOpen(false); }
      else toast.error(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        {t("Kembalikan seluruh data sandbox (tugas, anggaran, anggota, dll.) ke contoh awal. Perubahanmu di Mode Demo akan hilang.")}
      </p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="shrink-0 border-amber-400/60 text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-500/10">
            <RotateCcw className="size-4" /> {t("Reset ke data awal")}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TriangleAlert className="size-4 text-amber-500" /> {t("Reset data demo?")}
            </DialogTitle>
            <DialogDescription>
              {t("Semua data Mode Demo akan dihapus dan diganti dengan contoh awal. Data asli (produksi) tidak terpengaruh.")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">{t("Batal")}</Button></DialogClose>
            <Button variant="destructive" disabled={pending} onClick={reset}>
              {pending && <Loader2 className="size-4 animate-spin" />}{t("Reset sekarang")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
