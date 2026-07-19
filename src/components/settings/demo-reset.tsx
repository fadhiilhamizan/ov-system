"use client";
import * as React from "react";
import { toast } from "sonner";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger,
} from "@/components/ui/dialog";
import { resetDemoDataAction } from "@/lib/actions/demo";
import { useT } from "@/lib/i18n/provider";

export function DemoResetPanel() {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        {t("Kembalikan edisi Ormawa Visit Demo ke data mockup awal. Hanya data demo yang terpengaruh — data Ormawa Visit asli tidak berubah.")}
      </p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="shrink-0">
            <RotateCcw className="size-4" /> {t("Reset Data Demo")}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Reset Data Demo?")}</DialogTitle>
            <DialogDescription>
              {t("Semua perubahan pada edisi Demo akan dihapus dan dikembalikan ke data mockup awal. Tindakan ini tidak memengaruhi data Ormawa Visit asli.")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">{t("Batal")}</Button></DialogClose>
            <Button
              disabled={pending}
              onClick={() => start(async () => {
                const res = await resetDemoDataAction();
                if (res.ok) { toast.success(t("Data demo direset")); setOpen(false); }
                else toast.error(res.error);
              })}
            >
              {pending && <Loader2 className="size-4 animate-spin" />} {t("Reset Data Demo")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
