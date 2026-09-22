"use client";

import { usePathname } from "next/navigation";
import Icon from "@/components/ui/Icon";
import LocationTabs from "@/components/layout/LocationTabs";
import UserMenu from "@/components/layout/UserMenu";
import { cn } from "@/lib/cn";

type TopNavProps = {
  userName?: string;
  userRole?: string;
  onLogout?: () => void;
};

const pageTitles: Record<string, string> = {
  "/schedule": "Weekly Matrix",
  "/on-duty": "Live Floor & Duty",
  "/open-shifts": "Open Shifts Pool",
  "/swaps": "Open Shifts Pool",
  "/users": "Staff Roster",
  "/dashboard": "Dashboard",
  "/locations": "Locations",
  "/my-schedule": "My Schedule",
  "/availability": "Availability",
};

function pageTitle(pathname: string) {
  return pageTitles[pathname] ?? "ShiftSync";
}

export default function TopNav({
  userName = "Manager",
  userRole = "manager",
  onLogout,
}: TopNavProps) {
  const pathname = usePathname();
  const title = pageTitle(pathname);
  const isSchedule = pathname.startsWith("/schedule");
  const isRoster = pathname.startsWith("/users");
  const minimalNav = isRoster;

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

          <div className="relative flex-1 max-w-md min-w-0 hidden md:block">
            <Icon
              name="search"
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search shifts, staff, units…"
              className="w-full h-9 pl-9 pr-4 text-body-sm bg-surface-container-low/80 border-0 rounded-full focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:bg-surface-container-lowest placeholder:text-outline/80 transition-all"
            />
          </div>

          <div className="hidden lg:block shrink-0">
            <LocationTabs active="west" compact={isSchedule} />
          </div>

          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/8 border border-secondary/20 shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary" />
            </span>
            <span className="font-label-md text-label-md text-secondary font-semibold whitespace-nowrap">
              18 on duty
            </span>
          </div>
        </>
      )}

      <div className="flex items-center gap-1 shrink-0 ml-auto">
        {!minimalNav && (
          <>
            {isSchedule && (
              <span className="hidden lg:flex items-center gap-1 mr-1 px-2 py-1 rounded-full bg-surface-container-high text-[10px] font-badge-mono text-badge-mono text-on-surface-variant">
                <Icon name="lock_clock" size={13} className="text-secondary" />
                48h freeze
              </span>
            )}

            <div className="hidden sm:flex items-center gap-0.5 p-0.5 rounded-full bg-surface-container-low border border-outline-variant/60">
              <button
                type="button"
                title="Notifications"
                className="relative p-2 rounded-full text-on-surface-variant hover:text-primary hover:bg-surface-container-lowest transition-colors"
              >
                <Icon name="notifications" size={20} />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-error ring-2 ring-surface-container-low" />
              </button>
            </div>

            <button
              type="button"
              className="hidden sm:flex items-center gap-1.5 h-9 px-4 rounded-full font-label-md text-label-md font-semibold transition-all active:scale-[0.98] shadow-sm ml-1 bg-secondary text-on-secondary hover:bg-on-secondary-container"
            >
              <Icon name="add" size={18} />
              <span className="hidden lg:inline">Add Shift</span>
            </button>

            <div className="hidden sm:block h-8 w-px bg-outline-variant/60 mx-1" />
          </>
        )}

        <UserMenu name={userName} role={userRole} onLogout={onLogout} />
      </div>
    </header>
  );
}
