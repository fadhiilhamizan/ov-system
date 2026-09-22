"use client";
import * as React from "react";
import { toast } from "sonner";
import { Loader2, Megaphone, Pencil, Search, Send, Trash2, Users } from "lucide-react";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty";
import {
  createBroadcastAction, deleteBroadcastAction, updateBroadcastAction,
} from "@/lib/actions/inbox";
import { ROLE_META, ROLE_ORDER } from "@/lib/constants";
import { formatCommentTime } from "@/lib/task-comments";
import { useResetOn } from "@/lib/use-synced";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import type { Account, BroadcastAudience, BroadcastWithStats, Role } from "@/lib/types";

// ============================================================
// The admin half of Kotak Masuk: write a broadcast, choose who gets it, and
// manage what was already sent.
//
// The four things the feature has to offer - everyone, a subset, one account,
// or a role - are three audience modes, not four: "one account" is just the
// account picker with a single tick. Making it a separate mode would mean a
// second code path that does the same thing and can drift from it.
// ============================================================

const AUDIENCES: { value: BroadcastAudience; label: string; hint: string }[] = [
  { value: "all", label: "Semua akun", hint: "Semua akun yang terdaftar saat ini" },
  { value: "role", label: "Peran tertentu", hint: "Semua akun dengan peran yang dipilih" },
  { value: "accounts", label: "Akun tertentu", hint: "Pilih satu atau beberapa akun" },
];

/** Who a sent broadcast went to, in one readable line. */
function audienceLabel(
  b: { audience: BroadcastAudience; roles: Role[] },
  t: (s: string) => string,
): string {
  if (b.audience === "all") return t("Semua akun");
  if (b.audience === "role") {
    return `${t("Peran")}: ${b.roles.map((r) => t(ROLE_META[r]?.label ?? r)).join(", ")}`;
  }
  return t("Akun tertentu");
}

function BroadcastForm({
  accounts,
  existing,
  recipientIds,
  open,
  onOpenChange,
}: {
  accounts: Account[];
  existing?: BroadcastWithStats;
  /** Who the broadcast being edited currently reaches. */
  recipientIds?: string[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const t = useT();
  const [pending, start] = React.useTransition();
  const formKey = `${open}:${existing?.id ?? "new"}`;
  const [form, setForm] = useResetOn(formKey, () => ({
    title: existing?.title ?? "",
    body: existing?.body ?? "",
    audience: (existing?.audience ?? "all") as BroadcastAudience,
    roles: (existing?.roles ?? []) as Role[],
  }));
  const [picked, setPicked] = useResetOn<Set<string>>(
    formKey,
    () => new Set(existing?.audience === "accounts" ? recipientIds ?? [] : []),
  );
  const [q, setQ] = useResetOn(formKey, () => "");

  const shown = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return accounts;
    return accounts.filter((a) =>
      `${a.name} ${a.email}`.toLowerCase().includes(needle));
  }, [accounts, q]);

  // How many inboxes this will actually land in, worked out the same way the
  // server does. Shown live, because "kirim ke peran Intern" reaching nobody
  // is something the admin can only otherwise discover after sending.
  const reach = React.useMemo(() => {
    if (form.audience === "all") return accounts.length;
    if (form.audience === "role") {
      return accounts.filter((a) => form.roles.includes(a.role)).length;
    }
    return picked.size;
  }, [accounts, form.audience, form.roles, picked]);

  function toggleRole(r: Role) {
    setForm((f) => ({
      ...f,
      roles: f.roles.includes(r) ? f.roles.filter((x) => x !== r) : [...f.roles, r],
    }));
  }
  function toggleAccount(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function submit() {
    const payload = {
      title: form.title,
      body: form.body,
      audience: form.audience,
      roles: form.roles,
      user_ids: [...picked],
    };
    start(async () => {
      const res = existing
        ? await updateBroadcastAction(existing.id, payload)
        : await createBroadcastAction(payload);
      if (res.ok) {
        toast.success(existing ? t("Siaran diperbarui") : t("Siaran terkirim"));
        onOpenChange(false);
      } else toast.error(res.error);
    });
  }

  const canSend = form.title.trim() && form.body.trim() && reach > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{existing ? t("Ubah Siaran") : t("Siaran Baru")}</DialogTitle>
          <DialogDescription>
            {t("Pesan ini masuk ke Kotak Masuk akun yang kamu pilih.")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[65vh] gap-4 overflow-y-auto px-0.5 py-1">
          <div className="grid gap-1.5">
            <Label htmlFor="bc-title">
              {t("Judul")} <span className="text-danger">*</span>
            </Label>
            <Input
              id="bc-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={t("Contoh: Rapat koordinasi dimajukan")}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="bc-body">
              {t("Isi pesan")} <span className="text-danger">*</span>
            </Label>
            <Textarea
              id="bc-body"
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder={t("Tulis pengumumannya di sini…")}
              className="min-h-[120px]"
            />
          </div>

          <div className="grid gap-1.5">
            <Label>{t("Kirim ke")}</Label>
            <div className="grid gap-1.5 sm:grid-cols-3">
              {AUDIENCES.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => setForm({ ...form, audience: a.value })}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left text-xs transition",
                    form.audience === a.value
                      ? "border-primary bg-accent/60 text-foreground"
                      : "border-border hover:bg-muted",
                  )}
                >
                  <span className="block font-medium">{t(a.label)}</span>
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">{t(a.hint)}</span>
                </button>
              ))}
            </div>
          </div>

          {form.audience === "role" && (
            <div className="grid gap-1.5">
              <Label>{t("Peran tujuan")}</Label>
              <div className="flex flex-wrap gap-2">
                {/* Tanpa Tamu: peran itu tidak punya akses Kotak Masuk, jadi
                    menawarkannya sebagai tujuan berarti menjanjikan pengiriman
                    yang tidak akan pernah bisa dibaca. `getAccounts` juga sudah
                    menyaringnya, jadi angkanya akan selalu 0. */}
                {ROLE_ORDER.filter((r) => r !== "guest").map((r) => {
                  const n = accounts.filter((a) => a.role === r).length;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => toggleRole(r)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition",
                        form.roles.includes(r)
                          ? "border-primary bg-accent/60"
                          : "border-border hover:bg-muted",
                      )}
                    >
                      {t(ROLE_META[r].label)}
                      <span className="text-[10px] text-muted-foreground">{n}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {form.audience === "accounts" && (
            <div className="grid gap-1.5">
              <Label>{t("Pilih akun")}</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t("Cari nama atau email…")}
                  className="h-9 pl-8 text-sm"
                />
              </div>
              <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
                {shown.length === 0 ? (
                  <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                    {accounts.length === 0
                      ? t("Belum ada akun terdaftar.")
                      : t("Tidak ada akun yang cocok.")}
                  </p>
                ) : (
                  shown.map((a) => (
                    <label
                      key={a.id}
                      className="flex cursor-pointer items-center gap-2.5 border-b border-border/60 px-3 py-2 last:border-0 hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={picked.has(a.id)}
                        onCheckedChange={() => toggleAccount(a.id)}
                        aria-label={a.name || a.email}
                      />
                      <Avatar name={a.name || a.email} size={22} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium">{a.name || a.email}</span>
                        <span className="block truncate text-[10px] text-muted-foreground">{a.email}</span>
                      </span>
                      <Badge variant="outline">{t(ROLE_META[a.role]?.label ?? a.role)}</Badge>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          <p
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs",
              reach > 0
                ? "bg-muted text-muted-foreground"
                : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
            )}
          >
            <Users className="size-3.5" />
            {reach > 0
              ? `${t("Akan masuk ke")} ${reach} ${t("kotak masuk")}`
              : t("Belum ada akun yang cocok dengan tujuan ini, jadi siaran belum bisa dikirim.")}
          </p>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t("Batal")}</Button>
          </DialogClose>
          <Button onClick={submit} disabled={pending || !canSend}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {existing ? t("Simpan Perubahan") : t("Kirim Siaran")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BroadcastManager({
  broadcasts,
  accounts,
  recipientsById,
}: {
  broadcasts: BroadcastWithStats[];
  accounts: Account[];
  /** Recipient ids per broadcast, so editing re-opens with the right ticks. */
  recipientsById: Record<string, string[]>;
}) {
  const t = useT();
  const [composing, setComposing] = React.useState(false);
  const [editing, setEditing] = React.useState<BroadcastWithStats | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<BroadcastWithStats | null>(null);
  const [pending, start] = React.useTransition();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium">{t("Siaran terkirim")}</p>
        <span className="text-xs text-muted-foreground">{broadcasts.length}</span>
        <Button size="sm" className="ml-auto" onClick={() => setComposing(true)}>
          <Megaphone className="size-4" /> {t("Siaran Baru")}
        </Button>
      </div>

      {broadcasts.length === 0 ? (
        <EmptyState
          icon={<Megaphone />}
          title={t("Belum ada siaran")}
          description={t("Kirim pengumuman ke seluruh akun, peran tertentu, atau akun tertentu saja.")}
        />
      ) : (
        <div className="space-y-2">
          {broadcasts.map((b) => (
            <Card key={b.id} className="p-4">
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{b.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{b.body}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setEditing(b)}
                    className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    aria-label={t("Ubah siaran")}
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(b)}
                    className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-red-50 hover:text-danger dark:hover:bg-red-500/10"
                    aria-label={t("Hapus siaran")}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                <Badge variant="outline">{audienceLabel(b, t)}</Badge>
                <span>
                  {b.read_count}/{b.recipient_count} {t("sudah dibaca")}
                </span>
                <span aria-hidden>·</span>
                <span>{formatCommentTime(b.created_at)}</span>
                {b.created_by_name && (
                  <>
                    <span aria-hidden>·</span>
                    <span>{t("oleh")} {b.created_by_name}</span>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <BroadcastForm
        accounts={accounts}
        open={composing}
        onOpenChange={setComposing}
      />
      <BroadcastForm
        accounts={accounts}
        existing={editing ?? undefined}
        recipientIds={editing ? recipientsById[editing.id] : undefined}
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
      />

      <Dialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Hapus siaran?")}</DialogTitle>
            <DialogDescription>
              {t("Siaran")}{" "}
              <span className="font-medium text-foreground">“{confirmDelete?.title}”</span>{" "}
              {t("akan hilang dari kotak masuk semua penerimanya. Tindakan ini tidak dapat dibatalkan.")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t("Batal")}</Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => confirmDelete && start(async () => {
                const res = await deleteBroadcastAction(confirmDelete.id);
                if (res.ok) {
                  toast.success(t("Siaran dihapus"));
                  setConfirmDelete(null);
                } else toast.error(res.error);
              })}
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              {t("Hapus")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
