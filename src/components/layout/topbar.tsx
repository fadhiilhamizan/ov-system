"use client";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { navItemForPath } from "./nav-config";
import { EventSwitcher } from "./event-switcher";
import { DivisionFilter } from "./division-filter";
import { RoleSwitcher } from "./role-switcher";
import { UserMenu } from "./user-menu";
import { ThemeToggle } from "./theme-toggle";
import { LangToggle } from "./lang-toggle";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/provider";
import type { AppUser, Division, OVEvent } from "@/lib/types";

export function Topbar({
  user,
  events,
  activeEventId,
  divisions,
  activeDivision,
  demoMode,
  onMenu,
}: {
  user: AppUser;
  events: OVEvent[];
  activeEventId: string;
  divisions: Division[];
  activeDivision: string;
  demoMode: boolean;
  onMenu: () => void;
}) {
  const pathname = usePathname();
  const item = navItemForPath(pathname);
  const t = useT();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md md:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu} aria-label="Menu">
        <Menu />
      </Button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold leading-tight">
          {item ? t(item.label) : "Ormawa Visit"}
        </h1>
        <p className="hidden truncate text-xs text-muted-foreground sm:block">
          {item ? t(item.description) : ""}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <EventSwitcher events={events} activeId={activeEventId} />
        {divisions.length > 0 && <DivisionFilter divisions={divisions} active={activeDivision} />}
        <LangToggle />
        <ThemeToggle />
        {demoMode ? <RoleSwitcher user={user} /> : <UserMenu user={user} />}
      </div>
    </header>
  );
}
