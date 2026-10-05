"use client";
import * as React from "react";
import { ChevronsUpDown, Check, ShieldCheck } from "lucide-react";
import { DEMO_USERS } from "@/lib/demo-users";
import { ROLE_META } from "@/lib/constants";
import { setRole } from "@/lib/actions/session";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AppUser } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/provider";
import { Keyboard } from "lucide-react";
import { runShortcutCommand } from "./keyboard-shortcuts";

export function RoleSwitcher({ user }: { user: AppUser }) {
  const t = useT();
  const [pending, start] = React.useTransition();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-keyshortcuts="Shift+U"
        aria-label={t("Menu akun")}
        className={cn(
          "flex items-center gap-2 rounded-lg border border-border bg-card px-1.5 py-1 text-left shadow-sm sm:px-2 sm:py-1.5 transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring",
          pending && "opacity-60",
        )}
      >
        <Avatar name={user.name} color={user.avatarColor} size={28} />
        <div className="hidden min-w-0 leading-tight sm:block">
          <div className="truncate text-xs font-semibold">{user.name}</div>
          <div className="truncate text-[11px] text-muted-foreground">{t(ROLE_META[user.role].label)}</div>
        </div>
        <ChevronsUpDown className="hidden size-3.5 text-muted-foreground sm:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(18rem,calc(100vw-1.5rem))]">
        <DropdownMenuLabel className="flex items-center gap-1.5">
          <ShieldCheck className="size-3.5" /> {t("Ganti peran (mode demo)")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {DEMO_USERS.map((u) => (
          <DropdownMenuItem
            key={u.id}
            onSelect={() => start(() => setRole(u.id))}
            className="gap-3"
          >
            <Avatar name={u.name} color={u.avatarColor} size={30} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                {u.name}
                {u.id === user.id && <Check className="size-3.5 text-primary" />}
              </div>
              <div className="truncate text-[11px] text-muted-foreground">
                {t(ROLE_META[u.role].label)} - {t(ROLE_META[u.role].description)}
              </div>
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => runShortcutCommand("help")}>
          <Keyboard /> {t("Pintasan keyboard")}
          <kbd className="ml-auto rounded border border-border bg-muted px-1 font-mono text-[10px] text-muted-foreground">?</kbd>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
