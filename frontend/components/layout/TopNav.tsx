"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/ui/Icon";
import NotificationsMenu from "@/components/layout/NotificationsMenu";
import UserMenu from "@/components/layout/UserMenu";
import { titleForPath } from "@/components/layout/nav-config";
import { useDutySummary } from "@/hooks/useDutySummary";
import { useScheduleUiStore } from "@/stores/scheduleUiStore";
type TopNavProps = {
  userName: string;
  userRole: "admin" | "manager" | "staff";
  onLogout?: () => void;
};

export default function TopNav({ userName, userRole, onLogout }: TopNavProps) {
  const pathname = usePathname();
  const openAddShift = useScheduleUiStore((s) => s.openAddShift);
  const title = titleForPath(pathname);
  const isSchedule = pathname.startsWith("/schedule");
  const isRoster = pathname.startsWith("/users");
  const minimalNav = isRoster;
  const canManageDuty = userRole === "admin" || userRole === "manager";
  const canAddShift = isSchedule && canManageDuty;

  const { data: dutySummary } = useDutySummary(canManageDuty);

  return (
    <header className="sticky top-0 z-40 h-[60px] flex items-center gap-4 px-5 bg-surface-container-lowest/90 backdrop-blur-md border-b border-outline-variant/70 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
      <div className="flex flex-col min-w-0 shrink-0">
        <span className="font-data-mono text-data-mono text-[10px] uppercase tracking-widest text-outline">
          {userRole}
        </span>
        <h1 className="font-headline-md text-headline-md font-bold text-primary truncate leading-tight">
          {title}
        </h1>
      </div>

      {!minimalNav && (
        <>
          <div className="hidden sm:block h-8 w-px bg-outline-variant/60 shrink-0" />

          {canManageDuty && dutySummary && dutySummary.active_shifts > 0 && (
            <Link
              href="/on-duty"
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 shrink-0 hover:bg-slate-50 transition-colors"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-500 opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-800" />
              </span>
              <span className="font-label-md text-label-md text-slate-700 font-medium whitespace-nowrap">
                {dutySummary.total_clocked_in} on duty
                {dutySummary.total_tardy > 0 && (
                  <span className="text-slate-500"> · {dutySummary.total_tardy} tardy</span>
                )}
                {dutySummary.total_gaps > 0 && (
                  <span className="text-slate-500"> · {dutySummary.total_gaps} gaps</span>
                )}
              </span>
            </Link>
          )}
        </>
      )}

      <div className="flex items-center gap-1 shrink-0 ml-auto">
        {!minimalNav && (
          <>
            <div className="hidden sm:flex items-center gap-0.5 p-0.5 rounded-full bg-surface-container-low border border-outline-variant/60">
              <NotificationsMenu />
            </div>

            {canAddShift && (
              <button
                type="button"
                onClick={() => openAddShift()}
                className="hidden sm:flex items-center gap-1.5 h-9 px-4 rounded-full font-label-md text-label-md font-semibold transition-all active:scale-[0.98] shadow-sm ml-1 bg-secondary text-on-secondary hover:bg-on-secondary-container"
              >
                <Icon name="add" size={18} />
                <span className="hidden lg:inline">Add Shift</span>
              </button>
            )}
          </>
        )}

        <UserMenu name={userName} role={userRole} onLogout={onLogout} />
      </div>
    </header>
  );
}
