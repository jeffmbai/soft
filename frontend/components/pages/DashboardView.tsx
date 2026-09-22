"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  PageHeader,
  StatCard,
} from "@/components/ui";
import Loading from "@/components/Loading";
import { useAuth } from "@/providers/AuthProvider";
import {
  fetchLocations,
  fetchLocationsOverview,
  fetchSchedule,
  fetchStaff,
  formatShiftRange,
  mondayOfWeek,
  SKILL_LABELS,
} from "@/lib/api";
import { cn } from "@/lib/cn";

function todayDayOffset(weekStart: string): number {
  const ws = new Date(weekStart + "T12:00:00");
  const now = new Date();
  return Math.floor((now.getTime() - ws.getTime()) / 86400000);
}

function ManagerDashboard() {
  const weekStart = mondayOfWeek();
  const { data: locations = [], isLoading: locLoading } = useQuery({
    queryKey: ["locations"],
    queryFn: fetchLocations,
  });
  const [locationId, setLocationId] = useState("");
  const activeId = locationId || locations[0]?.id || "";

  const { data: schedule, isLoading: schedLoading } = useQuery({
    queryKey: ["schedule", activeId, weekStart],
    queryFn: () => fetchSchedule(activeId, weekStart),
    enabled: !!activeId,
  });

  const { data: staff = [] } = useQuery({
    queryKey: ["staff", activeId],
    queryFn: () => fetchStaff({ location_id: activeId }),
    enabled: !!activeId,
  });

  const activeLocation = locations.find((l) => l.id === activeId);
  const dayOffset = todayDayOffset(weekStart);

  const todayShifts = useMemo(() => {
    if (!schedule || dayOffset < 0 || dayOffset > 6) return [];
    return schedule.shifts.filter((s) => {
      const d = new Date(s.starts_at);
      const ws = new Date(weekStart + "T12:00:00");
      return Math.floor((d.getTime() - ws.getTime()) / 86400000) === dayOffset;
    });
  }, [schedule, weekStart, dayOffset]);

  const openSlots = (schedule?.shifts ?? []).reduce(
    (acc, s) => acc + Math.max(0, s.headcount - s.assignments.length),
    0,
  );

  const otWarnings = staff.filter((s) => s.assigned_hours >= 35);

  if (locLoading) return <Loading variant="inline" message="Loading dashboard…" />;

  return (
    <div className="flex flex-col gap-space-lg pb-24">
      <PageHeader
        title="Operations dashboard"
        description={`Week of ${weekStart}${activeLocation ? ` · ${activeLocation.name}` : ""}`}
      />

      <div className="flex flex-wrap gap-2">
        {locations.map((loc) => (
          <button
            key={loc.id}
            type="button"
            onClick={() => setLocationId(loc.id)}
            className={cn(
              "px-3 py-1.5 rounded-xl text-sm border transition-colors",
              loc.id === activeId
                ? "bg-secondary text-on-secondary border-secondary"
                : "border-outline-variant hover:border-secondary/50",
            )}
          >
            {loc.name}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Week status" value={schedule?.is_published ? "Published" : "Draft"} />
        <StatCard label="Shifts" value={String(schedule?.shifts.length ?? 0)} />
        <StatCard label="Open slots" value={String(openSlots)} />
        <StatCard label="OT warnings" value={String(otWarnings.length)} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/schedule">
          <Button variant="primary" size="sm">Open schedule</Button>
        </Link>
      </div>

      {schedLoading ? (
        <Loading variant="inline" message="Loading week…" />
      ) : (
        <>
          <Card className="space-y-3">
            <h2 className="font-title-md font-bold text-primary">Today&apos;s shifts</h2>
            {todayShifts.length === 0 ? (
              <p className="text-sm text-on-surface-variant">No shifts scheduled for today at this location.</p>
            ) : (
              <ul className="space-y-2">
                {todayShifts.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border border-outline-variant"
                  >
                    <div>
                      <span className="font-data-mono text-sm">
                        {activeLocation && formatShiftRange(s.starts_at, s.ends_at, activeLocation.timezone)}
                      </span>
                      <span className="text-on-surface-variant text-sm ml-2">
                        {SKILL_LABELS[s.required_skill]}
                      </span>
                    </div>
                    <Badge variant={s.assignments.length >= s.headcount ? "live" : "warning"}>
                      {s.assignments.length}/{s.headcount} filled
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {otWarnings.length > 0 && (
            <AlertBanner
              variant="warning"
              title="Overtime risk this week"
              description={`${otWarnings.length} staff member(s) at 35h+ assigned.`}
            />
          )}

          {otWarnings.length > 0 && (
            <Card className="space-y-2">
              <h2 className="font-title-md font-bold text-primary">Hours watchlist</h2>
              <ul className="divide-y divide-outline-variant">
                {otWarnings.map((s) => (
                  <li key={s.id} className="py-2 flex justify-between text-sm">
                    <span className="font-medium">{s.name}</span>
                    <span className="font-data-mono text-warning">{s.assigned_hours}h / {s.desired_hours_per_week ?? 40}h</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function AdminDashboard() {
  const weekStart = mondayOfWeek();
  const { data: locations = [], isLoading } = useQuery({
    queryKey: ["locations-overview"],
    queryFn: fetchLocationsOverview,
  });

  const scheduleQueries = useQuery({
    queryKey: ["dashboard-schedules", weekStart, locations.map((l) => l.id)],
    queryFn: async () => {
      const results = await Promise.all(
        locations.map(async (loc) => {
          const schedule = await fetchSchedule(loc.id, weekStart);
          return { locationId: loc.id, schedule };
        }),
      );
      return Object.fromEntries(results.map((r) => [r.locationId, r.schedule]));
    },
    enabled: locations.length > 0,
  });

  if (isLoading) return <Loading variant="inline" message="Loading dashboard…" />;

  const schedules = scheduleQueries.data ?? {};
  const totalOpen = Object.values(schedules).reduce(
    (acc, s) => acc + (s?.shifts ?? []).reduce((n, sh) => n + Math.max(0, sh.headcount - sh.assignments.length), 0),
    0,
  );

  return (
    <div className="flex flex-col gap-space-lg pb-24">
      <PageHeader
        title="Corporate dashboard"
        description={`Week of ${weekStart} · ${locations.length} locations`}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Locations" value={String(locations.length)} />
        <StatCard label="Open slots (all sites)" value={String(totalOpen)} />
        <StatCard label="Managers" value={String(new Set(locations.flatMap((l) => l.managers.map((m) => m.id))).size)} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/schedule"><Button variant="primary" size="sm">Schedule</Button></Link>
        <Link href="/locations"><Button variant="outline" size="sm">Locations</Button></Link>
        <Link href="/users"><Button variant="outline" size="sm">Staff roster</Button></Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {locations.map((loc) => {
          const sched = schedules[loc.id];
          const open = (sched?.shifts ?? []).reduce(
            (n, s) => n + Math.max(0, s.headcount - s.assignments.length),
            0,
          );
          return (
            <Card key={loc.id} className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-headline-md font-bold text-primary">{loc.name}</h2>
                  <p className="text-xs text-on-surface-variant mt-0.5">{loc.timezone}</p>
                </div>
                {sched && (
                  <Badge variant={sched.is_published ? "live" : "warning"}>
                    {sched.is_published ? "Published" : "Draft"}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-on-surface-variant">
                {sched ? `${sched.shifts.length} shifts · ${open} open` : "Loading…"}
              </p>
              <p className="text-xs text-outline">
                Managers: {loc.managers.map((m) => m.name).join(", ") || "None"}
              </p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default function DashboardView() {
  const { user } = useAuth();
  if (user?.role === "admin") return <AdminDashboard />;
  if (user?.role === "manager") return <ManagerDashboard />;
  return (
    <Card>
      <p className="text-on-surface-variant">Staff home is My Schedule.</p>
      <Link href="/my-schedule" className="text-secondary text-sm font-medium mt-2 inline-block">
        Go to My Schedule →
      </Link>
    </Card>
  );
}
