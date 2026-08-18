"use client";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { navItemForPath } from "./nav-config";
import { GlobalSearch } from "./global-search";
import { EventSwitcher } from "./event-switcher";
import { RoleSwitcher } from "./role-switcher";
import { UserMenu } from "./user-menu";
import { ThemeToggle } from "./theme-toggle";
import { LangToggle } from "./lang-toggle";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/provider";
import type { AppUser, OVEvent, RequestableRole, RoleRequest } from "@/lib/types";

export function Topbar({
  user,
  events,
  activeEventId,
  demoMode,
  sandboxMode,
  roleOptions = [],
  pendingRoleRequest = null,
  isDeveloper = false,
  onMenu,
}: {
  user: AppUser;
  events: OVEvent[];
  activeEventId: string;
  demoMode: boolean;
  sandboxMode: boolean;
  roleOptions?: RequestableRole[];
  pendingRoleRequest?: RoleRequest | null;
  /** Adds the hidden Developer entry to the account menu. */
  isDeveloper?: boolean;
  onMenu: () => void;
}) {
  const pathname = usePathname();
  const item = navItemForPath(pathname);
  const t = useT();
  // /developer is deliberately absent from NAV, so it has no nav item to take a
  // title from. Naming it here rather than adding a nav entry keeps it out of
  // the sidebar, the search palette, and the access matrix, which all read NAV.
  const onDeveloper = pathname.startsWith("/developer");

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md md:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu} aria-label={t("Menu")}>
        <Menu />
      </Button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold leading-tight">
          {item ? t(item.label) : onDeveloper ? "Developer" : "Ormawa Visit"}
        </h1>
        <p className="hidden truncate text-xs text-muted-foreground sm:block">
          {item ? t(item.description) : onDeveloper ? "Perkakas internal: jejak audit, kehadiran, error, konsol" : ""}
        </p>
      </div>

      {/* min-w-0 so this cluster can shrink; without it the buttons' combined
          min-content width pushes the whole page into horizontal overflow on
          tablet-sized screens. */}
      <div className="flex min-w-0 items-center gap-2">
        <GlobalSearch />
        <EventSwitcher events={events} activeId={activeEventId} />
        <LangToggle />
        <ThemeToggle />
        {demoMode || sandboxMode ? (
          <RoleSwitcher user={user} />
        ) : (
          <UserMenu user={user} roleOptions={roleOptions} pendingRoleRequest={pendingRoleRequest} isDeveloper={isDeveloper} />
        )}
      </div>
    </header>
  );
}
