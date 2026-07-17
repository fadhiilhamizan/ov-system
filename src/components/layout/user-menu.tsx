"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, LogOut, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ROLE_META } from "@/lib/constants";
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

export function UserMenu({ user }: { user: AppUser }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();

  function signOut() {
    start(async () => {
      await createClient().auth.signOut();
      router.push("/login");
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5 text-left shadow-sm transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring">
        <Avatar name={user.name} color={user.avatarColor} size={28} />
        <div className="hidden min-w-0 leading-tight sm:block">
          <div className="truncate text-xs font-semibold">{user.name}</div>
          <div className="truncate text-[11px] text-muted-foreground">{ROLE_META[user.role].label}</div>
        </div>
        <ChevronsUpDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <div className="font-medium text-foreground">{user.name}</div>
          <div className="text-[11px] text-muted-foreground">{user.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={(e) => { e.preventDefault(); signOut(); }}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <LogOut />} Keluar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
