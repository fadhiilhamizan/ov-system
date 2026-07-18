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

export function RoleSwitcher({ user }: { user: AppUser }) {
  const [pending, start] = React.useTransition();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5 text-left shadow-sm transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring",
          pending && "opacity-60",
        )}
      >
        <Avatar name={user.name} color={user.avatarColor} size={28} />
        <div className="hidden min-w-0 leading-tight sm:block">
          <div className="truncate text-xs font-semibold">{user.name}</div>
          <div className="truncate text-[11px] text-muted-foreground">{ROLE_META[user.role].label}</div>
        </div>
        <ChevronsUpDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="flex items-center gap-1.5">
          <ShieldCheck className="size-3.5" /> Ganti peran (mode demo)
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
                {ROLE_META[u.role].label} - {ROLE_META[u.role].description}
              </div>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
