"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Icon from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { fetchSwapRequests } from "@/lib/api";
import { liveQueryOptions } from "@/lib/live-query";
import { useScheduleUiStore } from "@/stores/scheduleUiStore";
import { mainNav, type NavItem } from "./nav-config";

type SidebarProps = {
  role: "admin" | "manager" | "staff";
};

const navSections: Record<string, { title: string; hrefs: string[] }> = {
  overview: {
    title: "Overview",
    hrefs: ["/dashboard"],
  },
  operations: {
    title: "Operations",
    hrefs: ["/schedule", "/on-duty", "/open-shifts", "/swaps", "/audit", "/my-schedule", "/availability"],
  },
  
  admin: {
    title: "Administration",
    hrefs: ["/users", "/locations"],
  },
};

function NavLink({ item, active, badge }: { item: NavItem; active: boolean; badge?: number }) {
  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-center gap-3 px-3 py-2 rounded-xl font-label-md text-label-md transition-all duration-150",
        active
          ? "bg-secondary/15 text-secondary-fixed font-semibold shadow-[inset_0_0_0_1px_rgba(137,245,231,0.15)]"
          : "text-on-primary-container hover:bg-white/5 hover:text-inverse-on-surface",
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center w-7 h-7 rounded-lg transition-colors",
          active
            ? "bg-secondary text-on-secondary"
            : "bg-white/5 text-on-primary-container group-hover:bg-white/10 group-hover:text-inverse-on-surface",
        )}
      >
        <Icon name={item.icon} size={16} filled={active} />
      </span>
      <span className="flex-1 truncate">{item.label}</span>
      {item.pulse && active && (
        <span className="w-2 h-2 rounded-full bg-secondary animate-pulse shrink-0" />
      )}
      {badge != null && badge > 0 && (
        <span className="shrink-0 bg-slate-800 text-white font-badge-mono text-[10px] px-1.5 py-0.5 rounded-full font-bold">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </Link>
  );
}

export default function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const triggerPublish = useScheduleUiStore((s) => s.triggerPublish);
  const isSchedule = pathname.startsWith("/schedule");
  const items = mainNav.filter((item) => item.roles.includes(role));
  const canManageSwaps = role === "admin" || role === "manager";

  const { data: swapRequests } = useQuery({
    queryKey: ["swap-requests"],
    queryFn: fetchSwapRequests,
    enabled: canManageSwaps,
    ...liveQueryOptions(),
  });
  const pendingApprovals =
    swapRequests?.filter((r) => r.status === "pending_manager").length ?? 0;

  const sections = Object.values(navSections)
    .map((section) => ({
      ...section,
      items: items.filter((item) => section.hrefs.includes(item.href)),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <aside className="h-screen w-[248px] fixed left-0 top-0 flex flex-col bg-primary-container z-50">
      {/* Brand */}
      <div className="px-4 pt-5 pb-4">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shadow-md ring-1 ring-white/10 group-hover:scale-[1.02] transition-transform">
            <Icon name="calendar_month" size={22} className="text-on-secondary" />
          </div>
          <div className="flex flex-col">
            <span className="font-headline-md text-headline-md font-bold text-inverse-on-surface leading-tight">
              ShiftSync
            </span>
            <span className="font-data-mono text-data-mono text-on-primary-container text-[10px] tracking-wide">
              WORKFORCE OS
            </span>
          </div>
        </Link>
      </div>

      {/* Quick action */}
      {(role === "admin" || role === "manager") && (
        <div className="px-4 mb-4">
          <button
            type="button"
            onClick={() => isSchedule && triggerPublish()}
            disabled={!isSchedule}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-label-md text-label-md active:scale-[0.99] transition-all shadow-lg",
              isSchedule
                ? "bg-secondary text-on-secondary hover:bg-on-secondary-container shadow-secondary/20"
                : "bg-white/10 text-on-primary-container/50 cursor-not-allowed shadow-none",
            )}
          >
            <Icon name="publish" size={18} />
            <span>Publish Schedule</span>
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 space-y-5">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="px-3 mb-1.5 font-badge-mono text-[10px] uppercase tracking-widest text-on-primary-container">
              {section.title}
            </p>
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={pathname === item.href || (item.href === "/open-shifts" && pathname === "/swaps")}
                  badge={item.href === "/open-shifts" ? pendingApprovals : undefined}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/8">
        <div className="flex gap-1">
          <Link
            href="/profile"
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-label-md text-label-md transition-colors",
              pathname === "/profile"
                ? "bg-secondary/15 text-secondary"
                : "text-on-primary-container hover:text-inverse-on-surface hover:bg-white/5",
            )}
          >
            <Icon name="person" size={16} />
            <span className="text-[11px]">Profile</span>
          </Link>
          <Link
            href="/settings"
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-label-md text-label-md transition-colors",
              pathname === "/settings"
                ? "bg-secondary/15 text-secondary"
                : "text-on-primary-container hover:text-inverse-on-surface hover:bg-white/5",
            )}
          >
            <Icon name="settings" size={16} />
            <span className="text-[11px]">Settings</span>
          </Link>
        </div>
      </div>
    </aside>
  );
}
