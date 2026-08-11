"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, LogOut, Loader2, UserRoundCheck, KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { exitGuestMode } from "@/lib/actions/session";
import { ROLE_META } from "@/lib/constants";
import { RoleRequestDialog } from "@/components/roles/role-request-dialog";
import { ChangePasswordDialog } from "@/components/auth/change-password-dialog";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useT } from "@/lib/i18n/provider";
import type { AppUser, RequestableRole, RoleRequest } from "@/lib/types";

export function UserMenu({
  user,
  roleOptions = [],
  pendingRoleRequest = null,
}: {
  user: AppUser;
  roleOptions?: RequestableRole[];
  pendingRoleRequest?: RoleRequest | null;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [requestOpen, setRequestOpen] = React.useState(false);
  const [passwordOpen, setPasswordOpen] = React.useState(false);

  // Any real account except an admin can use the flow - a role-less account to
  // get its first role, an existing one to move up or down. The server decides
  // the option list (see `requestableRolesFor`).
  const showRoleRequest = roleOptions.length > 0;
  // Guest is an anonymous Supabase session with no email and no password, so
  // there is nothing to change. (Demo mode never renders this menu at all -
  // the topbar shows the RoleSwitcher instead.)
  const showChangePassword = user.role !== "guest" && !!user.email;

  function signOut() {
    start(async () => {
      if (user.role === "guest") {
        // Drop the anonymous session too (guest mode signs in anonymously),
        // otherwise the anon session would linger after "logout".
        await createClient().auth.signOut();
        await exitGuestMode();
        return;
      }
      await createClient().auth.signOut();
      router.push("/login");
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5 text-left shadow-sm transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring">
          <Avatar name={user.name} color={user.avatarColor} size={28} />
          <div className="hidden min-w-0 leading-tight sm:block">
            <div className="truncate text-xs font-semibold">{user.name}</div>
            <div className="truncate text-[11px] text-muted-foreground">{t(ROLE_META[user.role].label)}</div>
          </div>
          <ChevronsUpDown className="size-3.5 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel>
            <div className="font-medium text-foreground">{user.name}</div>
            <div className="text-[11px] text-muted-foreground">{user.email}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {showRoleRequest && (
            <DropdownMenuItem onSelect={() => setRequestOpen(true)}>
              <UserRoundCheck />{" "}
              {pendingRoleRequest
                ? t("Ubah Pengajuan Peran")
                : user.role === "guest"
                  ? t("Ajukan Peran")
                  : t("Ajukan Ubah Peran")}
            </DropdownMenuItem>
          )}
          {showChangePassword && (
            <DropdownMenuItem onSelect={() => setPasswordOpen(true)}>
              <KeyRound /> {t("Ubah Kata Sandi")}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem destructive onSelect={(e) => { e.preventDefault(); signOut(); }}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <LogOut />} {t("Keluar")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {showChangePassword && (
        <ChangePasswordDialog email={user.email} open={passwordOpen} onOpenChange={setPasswordOpen} />
      )}

      {showRoleRequest && (
        <RoleRequestDialog
          options={roleOptions}
          existing={pendingRoleRequest}
          open={requestOpen}
          onOpenChange={setRequestOpen}
        />
      )}
    </>
  );
}
