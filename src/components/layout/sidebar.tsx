"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { NAV } from "./nav-config";
import { Logo } from "./logo";
import { can } from "@/lib/permissions";
import { ROLE_META } from "@/lib/constants";
import { useT } from "@/lib/i18n/provider";
import type { AppUser } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Unhandled-work counts to draw on menu entries, keyed by nav item key.
 *
 * Counted on the server (the shell's layout) rather than fetched here: the
 * sidebar renders on every route, and a client fetch per navigation would be
 * one request per page load for two numbers. Zero or missing means no badge at
 * all - a "0" pill is the same as nothing to do, and a menu full of zeroes
 * trains people to stop reading the badges.
 */
export type NavBadges = Record<string, number>;

/** The pill itself. Kept beside the sidebar because it is the only user. */
function NavBadge({ count, collapsed }: { count: number; collapsed: boolean }) {
  const label = count > 99 ? "99+" : String(count);
  if (collapsed) {
    // On the icon rail there is no room for a number beside the label, so it
    // rides on the icon's corner instead.
    return (
      <span className="absolute right-1 top-1 inline-flex min-w-[15px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold leading-[15px] text-primary-foreground">
        {label}
      </span>
    );
  }
  return (
    <span className="ml-auto inline-flex min-w-[18px] items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold leading-none text-primary-foreground">
      {label}
    </span>
  );
}

export function SidebarContent({
  user,
  badges,
  onNavigate,
  /** Render the narrow icon-only rail. */
  collapsed = false,
  /** When provided, a collapse/expand button is shown in the header. */
  onToggle,
  toggleCollapsed,
}: {
  user: AppUser;
  /** Per-menu counts of things waiting (unread inbox, pending role requests). */
  badges?: NavBadges;
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggle?: () => void;
  /** The persisted state (may differ from `collapsed` while hover-peeking). */
  toggleCollapsed?: boolean;
}) {
  const pathname = usePathname();
  const activeSeg = "/" + (pathname.split("/")[1] ?? "");
  const t = useT();
  const isCollapsed = toggleCollapsed ?? collapsed;

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className={cn("flex h-16 items-center gap-2.5", collapsed ? "justify-center px-2" : "px-5")}>
        <Logo size={34} />
        {!collapsed && (
          <>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-bold tracking-tight text-sidebar-foreground">Ormawa Visit</div>
              <div className="truncate text-[11px] text-sidebar-muted">Management System · EA HMSI</div>
            </div>
            {onToggle && (
              <button
                type="button"
                onClick={onToggle}
                className="-mr-1 ml-auto rounded-lg p-1.5 text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label={isCollapsed ? t("Buka menu samping") : t("Tutup menu samping")}
                title={isCollapsed ? t("Buka menu samping") : t("Tutup menu samping")}
              >
                {isCollapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
              </button>
            )}
          </>
        )}
      </div>

      <nav className={cn("no-scrollbar flex-1 overflow-y-auto py-3", collapsed ? "space-y-2 px-2" : "space-y-5 px-3")}>
        {NAV.map((group) => {
          const items = group.items.filter((i) => can.accessModule(user, i.key));
          if (!items.length) return null;
          return (
            <div key={group.group}>
              {collapsed ? (
                <div className="mx-2 mb-1.5 h-px bg-sidebar-border" aria-hidden />
              ) : (
                <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted">
                  {t(group.group)}
                </div>
              )}
              <div className="space-y-0.5">
                {items.map((item) => {
                  const active = activeSeg === item.href;
                  const Icon = item.icon;
                  const count = badges?.[item.key] ?? 0;
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      onClick={onNavigate}
                      title={collapsed ? t(item.label) : undefined}
                      // The count is IN the accessible name, not only in a
                      // coloured pill: a screen reader gets "Kotak Masuk, 3
                      // belum dibaca" rather than a menu entry that sounds
                      // identical whether or not anything is waiting.
                      aria-label={count ? `${t(item.label)}, ${count} ${t("belum ditangani")}` : undefined}
                      className={cn(
                        "group relative flex items-center rounded-lg py-2 text-sm font-medium transition-colors",
                        collapsed ? "justify-center px-2" : "gap-3 px-3",
                        active
                          ? "bg-sidebar-accent text-primary"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/60",
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-[18px] shrink-0 transition-colors",
                          active ? "text-primary" : "text-sidebar-muted group-hover:text-sidebar-foreground",
                        )}
                      />
                      {!collapsed && <span className="truncate">{t(item.label)}</span>}
                      {collapsed && <span className="sr-only">{t(item.label)}</span>}
                      {count > 0 && <NavBadge count={count} collapsed={collapsed} />}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className={cn("border-t border-sidebar-border", collapsed ? "p-2" : "p-3")}>
        {collapsed ? (
          <div
            className="flex flex-col items-center gap-1.5 rounded-lg bg-sidebar-accent/50 py-2.5"
            title={`${t("Peran")}: ${t(ROLE_META[user.role].label)}`}
          >
            <span className="size-1.5 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-semibold text-sidebar-foreground">
              {t(ROLE_META[user.role].label).slice(0, 3)}
            </span>
            {onToggle && (
              <button
                type="button"
                onClick={onToggle}
                className="mt-1 rounded-lg p-1.5 text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label={t("Buka menu samping")}
                title={t("Buka menu samping")}
              >
                <PanelLeftOpen className="size-4" />
              </button>
            )}
          </div>
        ) : (
          <div className="rounded-lg bg-sidebar-accent/50 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-sidebar-foreground">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              {t("Peran")}: {t(ROLE_META[user.role].label)}
            </div>
            <p className="mt-0.5 text-[11px] leading-snug text-sidebar-muted">
              {t(ROLE_META[user.role].description)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
