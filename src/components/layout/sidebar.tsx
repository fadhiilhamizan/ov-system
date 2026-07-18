"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "./nav-config";
import { Logo } from "./logo";
import { can } from "@/lib/permissions";
import { ROLE_META } from "@/lib/constants";
import { useT } from "@/lib/i18n/provider";
import type { AppUser } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SidebarContent({
  user,
  onNavigate,
}: {
  user: AppUser;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const activeSeg = "/" + (pathname.split("/")[1] ?? "");
  const t = useT();

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <Logo size={34} />
        <div className="leading-tight">
          <div className="text-sm font-bold tracking-tight text-sidebar-foreground">Ormawa Visit</div>
          <div className="text-[11px] text-sidebar-muted">Command Center · EA HMSI</div>
        </div>
      </div>

      <nav className="no-scrollbar flex-1 space-y-5 overflow-y-auto px-3 py-3">
        {NAV.map((group) => {
          const items = group.items.filter((i) => can.accessModule(user, i.key));
          if (!items.length) return null;
          return (
            <div key={group.group}>
              <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted">
                {t(group.group)}
              </div>
              <div className="space-y-0.5">
                {items.map((item) => {
                  const active = activeSeg === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
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
                      <span className="truncate">{t(item.label)}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="rounded-lg bg-sidebar-accent/50 px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-sidebar-foreground">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            {t("Peran")}: {t(ROLE_META[user.role].label)}
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-sidebar-muted">
            {t(ROLE_META[user.role].description)}
          </p>
        </div>
      </div>
    </div>
  );
}
