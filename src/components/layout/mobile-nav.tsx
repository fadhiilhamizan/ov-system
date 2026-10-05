"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { ALL_NAV_ITEMS } from "./nav-config";
import { can } from "@/lib/permissions";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import type { AppUser } from "@/lib/types";
import type { NavBadges } from "./sidebar";

/** The four menus people open most on a phone, in thumb order. */
/** Labels that fit under a tab icon on a 360px screen. */
const SHORT: Record<string, string> = { tasks: "WBS", prospects: "Reach", members: "Anggota" };
const PREFERRED = ["dashboard", "tasks", "calendar", "rundown", "prospects", "links", "members"];

/**
 * Bottom tab bar for phones (hidden from lg up, where the sidebar is always
 * there). Four menus within thumb reach plus "Menu", which opens the full
 * drawer. Menus the account cannot open are skipped and the next preferred one
 * takes the slot, so a Tamu never sees a tab that leads to a refusal.
 */
export function MobileNav({
  user, badges, onMenu,
}: {
  user: AppUser;
  badges?: NavBadges;
  onMenu: () => void;
}) {
  const t = useT();
  const pathname = usePathname();
  const activeSeg = "/" + (pathname.split("/")[1] ?? "");
  const resolved = activeSeg === "/divisions" ? "/members" : activeSeg;
  const items = PREFERRED
    .map((k) => ALL_NAV_ITEMS.find((i) => i.key === k)!)
    .filter((i) => i && can.accessModule(user, i.key))
    .slice(0, 4);
  // Something waiting in a menu that has no tab of its own shows on "Menu".
  const hidden = Object.entries(badges ?? {})
    .filter(([k]) => !items.some((i) => i.key === k))
    .reduce((n, [, c]) => n + c, 0);

  return (
    <nav
      aria-label={t("Navigasi bawah")}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {items.map((item) => {
          const Icon = item.icon;
          const active = resolved === item.href;
          const count = badges?.[item.key] ?? 0;
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-14 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className={cn("flex h-7 w-12 items-center justify-center rounded-full transition-colors", active && "bg-primary/10")}>
                  <Icon className="size-5" />
                </span>
                <span className="max-w-full truncate">{t(SHORT[item.key] ?? item.label)}</span>
                {count > 0 && (
                  <span className="absolute right-[22%] top-1.5 min-w-[16px] rounded-full bg-primary px-1 text-center text-[9px] font-bold leading-4 text-primary-foreground">
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
        <li className={cn(items.length < 4 && `col-start-5`)}>
          <button
            type="button"
            onClick={onMenu}
            className="relative flex h-14 w-full flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <span className="flex h-7 w-12 items-center justify-center rounded-full"><Menu className="size-5" /></span>
            <span>{t("Menu")}</span>
            {hidden > 0 && (
              <span className="absolute right-[22%] top-1.5 min-w-[16px] rounded-full bg-primary px-1 text-center text-[9px] font-bold leading-4 text-primary-foreground">
                {hidden > 99 ? "99+" : hidden}
              </span>
            )}
          </button>
        </li>
      </ul>
    </nav>
  );
}
