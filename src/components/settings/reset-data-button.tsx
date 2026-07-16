"use client";
import * as React from "react";
import { toast } from "sonner";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from "@/components/ui/dialog";
import { resetDemoData } from "@/lib/actions/session";

export function ResetDataButton() {
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <RotateCcw className="size-4" /> Reset ke data Excel awal
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reset data demo?</DialogTitle>
          <DialogDescription>
            Semua perubahan (tugas, prospek, tautan, anggaran) akan dikembalikan ke kondisi awal dari
            kedua file Excel. Tindakan ini tidak dapat dibatalkan.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Batal</Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await resetDemoData();
                toast.success("Data dikembalikan ke kondisi awal");
                setOpen(false);
              })
            }
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Reset sekarang
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
