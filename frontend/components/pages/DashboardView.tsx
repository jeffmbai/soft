"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import ChartCard from "@/components/charts/ChartCard";
import ChartDrillPanel from "@/components/charts/ChartDrillPanel";
import SimpleAreaChart from "@/components/charts/SimpleAreaChart";
import SimpleBarChart from "@/components/charts/SimpleBarChart";
import SimpleDonutChart from "@/components/charts/SimpleDonutChart";
import Loading from "@/components/Loading";
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  CardHeader,
  Icon,
  MetricsRow,
  PageHeader,
  StatCard,
  Timeline,
} from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import {
  fetchDutyFloor,
  fetchDutySummary,
  fetchLocations,
  fetchLocationsOverview,
  fetchMyShifts,
  fetchOpenShifts,
  fetchSchedule,
  fetchStaff,
  fetchSwapRequests,
  formatShiftRange,
  mondayOfWeek,
  SKILL_LABELS,
  SWAP_STATUS_LABELS,
} from "@/lib/api";
import {
  coverageDrillItems,
  dayLabel,
  filterMyShiftsByDay,
  filterShiftsByDay,
  filterShiftsBySkill,
  filterShiftsWithGaps,
  myShiftsToDrillItems,
  shiftsToDrillItems,
  staffToDrillItem,
  type DrillItem,
} from "@/lib/chart-drill";
import {
  CHART_COLORS,
  type ChartDatum,
  fillRate,
  myHoursByDay,
  openSlotsByLocation,
  shiftHours,
  shiftsByDay,
  skillMix,
  staffHoursChart,
  totalScheduledHours,
} from "@/lib/dashboard-metrics";
import { liveQueryOptions } from "@/lib/live-query";
import { cn } from "@/lib/cn";

type DrillState = { key: string; datum: ChartDatum } | null;

function useChartDrill() {
  const [drill, setDrill] = useState<DrillState>(null);
  const toggle = (key: string) => (datum: ChartDatum) => {
    setDrill((prev) =>
      prev?.key === key && prev.datum.id === datum.id ? null : { key, datum },
    );
  };
  const clear = () => setDrill(null);
  const activeId = (key: string) => (drill?.key === key ? drill.datum.id ?? null : null);
  return { drill, toggle, clear, activeId };
}

function todayDayOffset(weekStart: string): number {
  const ws = new Date(weekStart + "T12:00:00");
  const now = new Date();
  return Math.floor((now.getTime() - ws.getTime()) / 86400000);
}

function QuickLinks({ links }: { links: { href: string; label: string; variant?: "primary" | "outline" }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link) => (
        <Link key={link.href} href={link.href}>
          <Button variant={link.variant ?? "outline"} size="sm">{link.label}</Button>
        </Link>
      ))}
    </div>
  );
}

function LocationTabs({
  locations,
  activeId,
  onChange,
}: {
  locations: { id: string; name: string }[];
  activeId: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {locations.map((loc) => (
        <button
          key={loc.id}
          type="button"
          onClick={() => onChange(loc.id)}
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
  );
}

function StaffDashboard() {
  const { user } = useAuth();
  const weekStart = mondayOfWeek();

  const { data: upcoming = [], isLoading: shiftsLoading } = useQuery({
    queryKey: ["my-shifts", "upcoming"],
    queryFn: () => fetchMyShifts({ upcoming: true }),
    ...liveQueryOptions(60_000),
  });

  const { data: weekShifts = [] } = useQuery({
    queryKey: ["my-shifts", weekStart],
    queryFn: () => fetchMyShifts({ week: weekStart }),
  });

  const { data: openShifts = [] } = useQuery({
    queryKey: ["open-shifts"],
    queryFn: fetchOpenShifts,
    ...liveQueryOptions(),
  });

  const { data: swaps = [] } = useQuery({
    queryKey: ["swap-requests"],
    queryFn: fetchSwapRequests,
    ...liveQueryOptions(),
  });

  const activeShift = upcoming.find((s) => s.duty?.is_active);
  const nextShift = upcoming.find((s) => !s.duty?.is_active);
  const weekHours = Math.round(weekShifts.reduce((n, s) => n + shiftHours(s.starts_at, s.ends_at), 0) * 10) / 10;
  const pendingSwaps = swaps.filter(
    (s) => s.status.startsWith("pending") && (s.requester.id === user?.id || s.can_accept),
  ).length;
  const hoursChart = myHoursByDay(weekShifts, weekStart);
  const { drill, toggle, clear, activeId } = useChartDrill();

  const myHoursDrill = (): { title: string; items: DrillItem[] } | null => {
    if (drill?.key !== "my-hours") return null;
    const dayIndex = drill.datum.meta?.dayIndex as number | undefined;
    if (dayIndex == null) return null;
    const dayShifts = filterMyShiftsByDay(weekShifts, weekStart, dayIndex);
    return {
      title: `${dayLabel(dayIndex)} · ${dayShifts.length} shift${dayShifts.length === 1 ? "" : "s"}`,
      items: myShiftsToDrillItems(dayShifts),
    };
  };

  const myHoursDrillData = myHoursDrill();

  if (shiftsLoading) return <Loading variant="inline" message="Loading dashboard…" />;

  return (
    <div className="flex flex-col gap-space-lg pb-24">
      <PageHeader
        title={`Welcome, ${user?.name?.split(" ")[0] ?? "there"}`}
        description={`Week of ${weekStart} · your schedule overview`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Hours this week" value={`${weekHours}h`} />
        <StatCard label="Upcoming shifts" value={String(upcoming.length)} />
        <StatCard label="Open shifts" value={String(openShifts.length)} />
        <StatCard
          label="Pending requests"
          value={String(pendingSwaps)}
          alert={pendingSwaps > 0}
        />
      </div>

      <QuickLinks
        links={[
          { href: "/my-schedule", label: "My Schedule", variant: "primary" },
          { href: "/open-shifts", label: "Open shifts" },
          { href: "/availability", label: "Availability" },
        ]}
      />

      {activeShift && (
        <Card accent="secondary" className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-data-mono uppercase text-secondary tracking-wider">On shift now</p>
              <h2 className="font-headline-md font-bold text-primary mt-1">{activeShift.location_name}</h2>
              <p className="text-sm text-on-surface-variant">
                {formatShiftRange(activeShift.starts_at, activeShift.ends_at, activeShift.location_timezone)}
              </p>
            </div>
            <Badge variant="live">
              {activeShift.duty?.duty_status === "clocked_in" ? "Clocked in" : "Active"}
            </Badge>
          </div>
          <Link href="/my-schedule">
            <Button variant="primary" size="sm">Manage shift</Button>
          </Link>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="My hours this week"
          subtitle="Scheduled hours by day"
          isDrilled={drill?.key === "my-hours"}
          drill={
            myHoursDrillData ? (
              <ChartDrillPanel
                title={myHoursDrillData.title}
                items={myHoursDrillData.items}
                onClose={clear}
                action={{ href: "/my-schedule", label: "Open My Schedule" }}
                emptyMessage="No shifts on this day."
              />
            ) : null
          }
        >
          <SimpleAreaChart
            data={hoursChart}
            activeId={activeId("my-hours")}
            onDatumClick={toggle("my-hours")}
          />
        </ChartCard>

        <Card className="space-y-3">
          <CardHeader title="Next shift" subtitle={nextShift ? undefined : "Nothing scheduled ahead"} />
          {nextShift ? (
            <div className="rounded-xl border border-outline-variant p-4 space-y-2">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <p className="font-medium text-primary">{nextShift.location_name}</p>
                  <p className="text-sm text-on-surface-variant">{SKILL_LABELS[nextShift.required_skill]}</p>
                </div>
                <span className="font-data-mono text-xs text-outline">
                  {shiftHours(nextShift.starts_at, nextShift.ends_at).toFixed(1)}h
                </span>
              </div>
              <p className="font-data-mono text-sm">
                {formatShiftRange(nextShift.starts_at, nextShift.ends_at, nextShift.location_timezone)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-on-surface-variant">Check open shifts to pick up extra hours.</p>
          )}
        </Card>
      </div>

      {pendingSwaps > 0 && (
        <Card className="space-y-2">
          <CardHeader title="Your swap activity" />
          <ul className="divide-y divide-outline-variant">
            {swaps
              .filter((s) => s.requester.id === user?.id || s.can_accept)
              .slice(0, 5)
              .map((s) => (
                <li key={s.id} className="py-2 flex justify-between gap-2 text-sm">
                  <span className="truncate">{s.shift.location_name} · {SKILL_LABELS[s.shift.required_skill as keyof typeof SKILL_LABELS]}</span>
                  <Badge variant={s.status.startsWith("pending") ? "warning" : "default"}>
                    {SWAP_STATUS_LABELS[s.status]}
                  </Badge>
                </li>
              ))}
          </ul>
        </Card>
      )}
    </div>
  );
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

  const { data: dutySummary } = useQuery({
    queryKey: ["duty-summary"],
    queryFn: fetchDutySummary,
    ...liveQueryOptions(),
  });

  const { data: dutyFloor } = useQuery({
    queryKey: ["duty-floor"],
    queryFn: fetchDutyFloor,
    ...liveQueryOptions(),
  });

  const { data: swapRequests = [] } = useQuery({
    queryKey: ["swap-requests"],
    queryFn: fetchSwapRequests,
    ...liveQueryOptions(),
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
  const pendingApprovals = swapRequests.filter((s) => s.can_approve).length;
  const rate = fillRate(schedule?.shifts ?? []);
  const coverageData = [
    { name: "Clocked in", value: dutySummary?.total_clocked_in ?? 0, fill: CHART_COLORS[0], id: "clocked_in" },
    { name: "Tardy", value: dutySummary?.total_tardy ?? 0, fill: CHART_COLORS[6], id: "tardy" },
    { name: "Gaps", value: dutySummary?.total_gaps ?? 0, fill: CHART_COLORS[5], id: "gaps" },
  ];
  const { drill, toggle, clear, activeId: drillActiveId } = useChartDrill();
  const tz = activeLocation?.timezone ?? "UTC";
  const shifts = schedule?.shifts ?? [];

  const shiftsByDayDrill = (): { title: string; items: DrillItem[] } | null => {
    if (drill?.key !== "mgr-shifts-day") return null;
    const dayIndex = drill.datum.meta?.dayIndex as number | undefined;
    if (dayIndex == null) return null;
    const dayShifts = filterShiftsByDay(shifts, weekStart, dayIndex);
    return {
      title: `${dayLabel(dayIndex)} · ${dayShifts.length} shift${dayShifts.length === 1 ? "" : "s"}`,
      items: shiftsToDrillItems(dayShifts, tz),
    };
  };

  const staffHoursDrill = (): { title: string; items: DrillItem[] } | null => {
    if (drill?.key !== "mgr-staff-hours") return null;
    const staffId = drill.datum.meta?.staffId as string | undefined;
    const member = staff.find((s) => s.id === staffId);
    return {
      title: `${drill.datum.meta?.fullName ?? drill.datum.name} · ${drill.datum.value}h`,
      items: staffToDrillItem(member),
    };
  };

  const coverageDrill = (): { title: string; items: DrillItem[] } | null => {
    if (drill?.key !== "mgr-coverage") return null;
    const segment = drill.datum.id ?? drill.datum.name;
    const items = coverageDrillItems(dutyFloor, segment);
    return {
      title: `${drill.datum.name} · ${drill.datum.value}`,
      items,
    };
  };

  const roleMixDrill = (): { title: string; items: DrillItem[] } | null => {
    if (drill?.key !== "mgr-role-mix") return null;
    const skill = drill.datum.meta?.skill as import("@/lib/api").Skill | undefined;
    if (!skill) return null;
    const skillShifts = filterShiftsBySkill(shifts, skill);
    return {
      title: `${drill.datum.name} · ${skillShifts.length} shift${skillShifts.length === 1 ? "" : "s"}`,
      items: shiftsToDrillItems(skillShifts, tz),
    };
  };

  const mgrShiftsDayDrill = shiftsByDayDrill();
  const mgrStaffHoursDrill = staffHoursDrill();
  const mgrCoverageDrill = coverageDrill();
  const mgrRoleMixDrill = roleMixDrill();

  if (locLoading) return <Loading variant="inline" message="Loading dashboard…" />;

  return (
    <div className="flex flex-col gap-space-lg pb-24">
      <PageHeader
        title="Operations dashboard"
        description={`Week of ${weekStart}${activeLocation ? ` · ${activeLocation.name}` : ""}`}
      />

      <LocationTabs locations={locations} activeId={activeId} onChange={setLocationId} />

      <MetricsRow
        metrics={[
          { label: "On duty", value: String(dutySummary?.total_clocked_in ?? 0), tone: "secondary" },
          { label: "Tardy", value: String(dutySummary?.total_tardy ?? 0), tone: dutySummary?.total_tardy ? "error" : "muted" },
          { label: "Open slots", value: String(openSlots), tone: openSlots ? "error" : "muted" },
          { label: "Fill rate", value: `${rate}%` },
        ]}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Week status" value={schedule?.is_published ? "Published" : "Draft"} />
        <StatCard label="Shifts" value={String(schedule?.shifts.length ?? 0)} />
        <StatCard label="Scheduled hours" value={`${totalScheduledHours(schedule?.shifts ?? [])}h`} />
        <StatCard label="Pending approvals" value={String(pendingApprovals)} alert={pendingApprovals > 0} />
      </div>

      <QuickLinks
        links={[
          { href: "/schedule", label: "Schedule", variant: "primary" },
          { href: "/on-duty", label: "Live floor" },
          { href: "/open-shifts", label: "Open shifts" },
        ]}
      />

      {schedLoading ? (
        <Loading variant="inline" message="Loading reports…" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Shifts by day"
            subtitle="Current week at selected location"
            isDrilled={drill?.key === "mgr-shifts-day"}
            drill={mgrShiftsDayDrill ? (
              <ChartDrillPanel
                title={mgrShiftsDayDrill.title}
                items={mgrShiftsDayDrill.items}
                onClose={clear}
                action={{ href: "/schedule", label: "Open schedule" }}
              />
            ) : null}
          >
            <SimpleBarChart
              data={shiftsByDay(schedule, weekStart)}
              valueSuffix=" shifts"
              activeId={drillActiveId("mgr-shifts-day")}
              onDatumClick={toggle("mgr-shifts-day")}
            />
          </ChartCard>
          <ChartCard
            title="Staff hours"
            subtitle="Top assigned hours this week"
            isDrilled={drill?.key === "mgr-staff-hours"}
            drill={mgrStaffHoursDrill ? (
              <ChartDrillPanel
                title={mgrStaffHoursDrill.title}
                items={mgrStaffHoursDrill.items}
                onClose={clear}
                action={{ href: "/schedule", label: "View schedule" }}
              />
            ) : null}
          >
            <SimpleBarChart
              data={staffHoursChart(staff)}
              valueSuffix="h"
              color={CHART_COLORS[1]}
              activeId={drillActiveId("mgr-staff-hours")}
              onDatumClick={toggle("mgr-staff-hours")}
            />
          </ChartCard>
          <ChartCard
            title="Live coverage"
            subtitle="Right now across your locations"
            isDrilled={drill?.key === "mgr-coverage"}
            drill={mgrCoverageDrill ? (
              <ChartDrillPanel
                title={mgrCoverageDrill.title}
                items={mgrCoverageDrill.items}
                onClose={clear}
                action={{ href: "/on-duty", label: "Open live floor" }}
              />
            ) : null}
          >
            <SimpleDonutChart
              data={coverageData}
              centerLabel={String(dutySummary?.total_clocked_in ?? 0)}
              activeId={drillActiveId("mgr-coverage")}
              onDatumClick={toggle("mgr-coverage")}
            />
          </ChartCard>
          <ChartCard
            title="Role mix"
            subtitle="Shifts by required skill"
            isDrilled={drill?.key === "mgr-role-mix"}
            drill={mgrRoleMixDrill ? (
              <ChartDrillPanel
                title={mgrRoleMixDrill.title}
                items={mgrRoleMixDrill.items}
                onClose={clear}
                action={{ href: "/schedule", label: "Open schedule" }}
              />
            ) : null}
          >
            <SimpleDonutChart
              data={skillMix(shifts)}
              activeId={drillActiveId("mgr-role-mix")}
              onDatumClick={toggle("mgr-role-mix")}
            />
          </ChartCard>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3">
          <CardHeader title="Today's shifts" subtitle={`${todayShifts.length} scheduled today`} />
          {todayShifts.length === 0 ? (
            <p className="text-sm text-on-surface-variant">No shifts scheduled for today.</p>
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
                    <span className="text-on-surface-variant text-sm ml-2">{SKILL_LABELS[s.required_skill]}</span>
                  </div>
                  <Badge variant={s.assignments.length >= s.headcount ? "live" : "warning"}>
                    {s.assignments.length}/{s.headcount} filled
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="space-y-3">
          <CardHeader
            title="Live activity"
            subtitle="Recent clock events"
            action={
              <Link href="/on-duty" className="text-secondary text-xs font-medium hover:underline">
                View floor
              </Link>
            }
          />
          {(dutyFloor?.activity ?? []).length === 0 ? (
            <p className="text-sm text-on-surface-variant">No recent clock activity.</p>
          ) : (
            <Timeline
              items={(dutyFloor?.activity ?? []).slice(0, 6).map((a) => ({
                id: a.id,
                time: new Date(a.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
                label: a.label,
                tone: a.tone,
              }))}
            />
          )}
        </Card>
      </div>

      {otWarnings.length > 0 && (
        <>
          <AlertBanner
            variant="warning"
            title="Overtime risk this week"
            description={`${otWarnings.length} staff member(s) at 35h+ assigned.`}
          />
          <Card className="space-y-2">
            <CardHeader title="Hours watchlist" />
            <ul className="divide-y divide-outline-variant">
              {otWarnings.map((s) => (
                <li key={s.id} className="py-2 flex justify-between text-sm">
                  <span className="font-medium">{s.name}</span>
                  <span className="font-data-mono text-warning">
                    {s.assigned_hours}h / {s.desired_hours_per_week ?? 40}h
                  </span>
                </li>
              ))}
            </ul>
          </Card>
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

  const { data: dutySummary } = useQuery({
    queryKey: ["duty-summary"],
    queryFn: fetchDutySummary,
    ...liveQueryOptions(),
  });

  const { data: swapRequests = [] } = useQuery({
    queryKey: ["swap-requests"],
    queryFn: fetchSwapRequests,
    ...liveQueryOptions(),
  });

  const { data: dutyFloor } = useQuery({
    queryKey: ["duty-floor"],
    queryFn: fetchDutyFloor,
    ...liveQueryOptions(),
  });

  const { drill, toggle, clear, activeId } = useChartDrill();

  if (isLoading) return <Loading variant="inline" message="Loading dashboard…" />;

  const schedules = scheduleQueries.data ?? {};
  const totalOpen = Object.values(schedules).reduce(
    (acc, s) => acc + (s?.shifts ?? []).reduce((n, sh) => n + Math.max(0, sh.headcount - sh.assignments.length), 0),
    0,
  );
  const allShifts = Object.values(schedules).flatMap((s) => s?.shifts ?? []);
  const totalShifts = allShifts.length;
  const rate = fillRate(allShifts);
  const pendingApprovals = swapRequests.filter((s) => s.can_approve).length;
  const managerCount = new Set(locations.flatMap((l) => l.managers.map((m) => m.id))).size;
  const tzByLocation = Object.fromEntries(locations.map((l) => [l.id, l.timezone]));

  const coverageData = [
    { name: "On duty", value: dutySummary?.total_clocked_in ?? 0, fill: CHART_COLORS[0], id: "clocked_in" },
    { name: "Scheduled", value: Math.max(0, (dutySummary?.total_scheduled ?? 0) - (dutySummary?.total_clocked_in ?? 0)), fill: CHART_COLORS[3], id: "scheduled" },
    { name: "Tardy", value: dutySummary?.total_tardy ?? 0, fill: CHART_COLORS[6], id: "tardy" },
    { name: "Gaps", value: dutySummary?.total_gaps ?? 0, fill: CHART_COLORS[5], id: "gaps" },
  ];

  const openSlotsDrill = (): { title: string; items: DrillItem[] } | null => {
    if (drill?.key !== "adm-open-slots") return null;
    const locationId = drill.datum.meta?.locationId as string | undefined;
    const loc = locations.find((l) => l.id === locationId);
    const sched = locationId ? schedules[locationId] : undefined;
    const gapShifts = filterShiftsWithGaps(sched?.shifts ?? []);
    return {
      title: `${loc?.name ?? drill.datum.name} · ${gapShifts.length} shift${gapShifts.length === 1 ? "" : "s"} with gaps`,
      items: shiftsToDrillItems(gapShifts, loc?.timezone ?? "UTC"),
    };
  };

  const admCoverageDrill = (): { title: string; items: DrillItem[] } | null => {
    if (drill?.key !== "adm-coverage") return null;
    const segment = drill.datum.id ?? drill.datum.name;
    return {
      title: `${drill.datum.name} · ${drill.datum.value}`,
      items: coverageDrillItems(dutyFloor, segment),
    };
  };

  const admRoleMixDrill = (): { title: string; items: DrillItem[] } | null => {
    if (drill?.key !== "adm-role-mix") return null;
    const skill = drill.datum.meta?.skill as import("@/lib/api").Skill | undefined;
    if (!skill) return null;
    const skillShifts = filterShiftsBySkill(allShifts, skill);
    return {
      title: `${drill.datum.name} · ${skillShifts.length} shift${skillShifts.length === 1 ? "" : "s"}`,
      items: shiftsToDrillItems(skillShifts, tzByLocation),
    };
  };

  const admShiftsLocDrill = (): { title: string; items: DrillItem[] } | null => {
    if (drill?.key !== "adm-shifts-loc") return null;
    const locationId = drill.datum.meta?.locationId as string | undefined;
    const loc = locations.find((l) => l.id === locationId);
    const sched = locationId ? schedules[locationId] : undefined;
    const locShifts = sched?.shifts ?? [];
    return {
      title: `${loc?.name ?? drill.datum.name} · ${locShifts.length} shifts`,
      items: shiftsToDrillItems(locShifts, loc?.timezone ?? "UTC"),
    };
  };

  const admOpenSlotsDrill = openSlotsDrill();
  const admCoverageDrillData = admCoverageDrill();
  const admRoleMixDrillData = admRoleMixDrill();
  const admShiftsLocDrillData = admShiftsLocDrill();

  return (
    <div className="flex flex-col gap-space-lg pb-24">
      <PageHeader
        title="Corporate dashboard"
        description={`Week of ${weekStart} · ${locations.length} locations · network overview`}
      />

      <MetricsRow
        metrics={[
          { label: "On duty now", value: String(dutySummary?.total_clocked_in ?? 0), tone: "secondary" },
          { label: "Active shifts", value: String(dutySummary?.active_shifts ?? 0) },
          { label: "Open slots", value: String(totalOpen), tone: totalOpen ? "error" : "muted" },
          { label: "Network fill", value: `${rate}%` },
        ]}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Locations" value={String(locations.length)} />
        <StatCard label="Total shifts" value={String(totalShifts)} />
        <StatCard label="Managers" value={String(managerCount)} />
        <StatCard label="Pending approvals" value={String(pendingApprovals)} alert={pendingApprovals > 0} />
      </div>

      <QuickLinks
        links={[
          { href: "/schedule", label: "Schedule", variant: "primary" },
          { href: "/on-duty", label: "Live floor" },
          { href: "/locations", label: "Locations" },
          { href: "/users", label: "Staff roster" },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Open slots by location"
          subtitle="Unfilled headcount this week"
          isDrilled={drill?.key === "adm-open-slots"}
          drill={admOpenSlotsDrill ? (
            <ChartDrillPanel
              title={admOpenSlotsDrill.title}
              items={admOpenSlotsDrill.items}
              onClose={clear}
              action={{ href: "/open-shifts", label: "Open shifts pool" }}
            />
          ) : null}
        >
          <SimpleBarChart
            data={openSlotsByLocation(locations, schedules)}
            valueSuffix=" open"
            color={CHART_COLORS[5]}
            activeId={activeId("adm-open-slots")}
            onDatumClick={toggle("adm-open-slots")}
          />
        </ChartCard>
        <ChartCard
          title="Live workforce"
          subtitle="Coverage across all sites"
          isDrilled={drill?.key === "adm-coverage"}
          drill={admCoverageDrillData ? (
            <ChartDrillPanel
              title={admCoverageDrillData.title}
              items={admCoverageDrillData.items}
              onClose={clear}
              action={{ href: "/on-duty", label: "Open live floor" }}
            />
          ) : null}
        >
          <SimpleDonutChart
            data={coverageData}
            centerLabel={String(dutySummary?.total_clocked_in ?? 0)}
            activeId={activeId("adm-coverage")}
            onDatumClick={toggle("adm-coverage")}
          />
        </ChartCard>
        <ChartCard
          title="Role mix"
          subtitle="All shifts network-wide"
          isDrilled={drill?.key === "adm-role-mix"}
          drill={admRoleMixDrillData ? (
            <ChartDrillPanel
              title={admRoleMixDrillData.title}
              items={admRoleMixDrillData.items}
              onClose={clear}
              action={{ href: "/schedule", label: "Open schedule" }}
            />
          ) : null}
        >
          <SimpleDonutChart
            data={skillMix(allShifts)}
            activeId={activeId("adm-role-mix")}
            onDatumClick={toggle("adm-role-mix")}
          />
        </ChartCard>
        <ChartCard
          title="Shifts by location"
          subtitle="Weekly shift count"
          isDrilled={drill?.key === "adm-shifts-loc"}
          drill={admShiftsLocDrillData ? (
            <ChartDrillPanel
              title={admShiftsLocDrillData.title}
              items={admShiftsLocDrillData.items}
              onClose={clear}
              action={{ href: "/schedule", label: "Open schedule" }}
            />
          ) : null}
        >
          <SimpleBarChart
            data={locations.map((loc) => ({
              name: loc.name.split(" ")[0] ?? loc.name,
              value: schedules[loc.id]?.shifts.length ?? 0,
              id: loc.id,
              meta: { locationId: loc.id, fullName: loc.name },
            }))}
            valueSuffix=" shifts"
            activeId={activeId("adm-shifts-loc")}
            onDatumClick={toggle("adm-shifts-loc")}
          />
        </ChartCard>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {locations.map((loc) => {
          const sched = schedules[loc.id];
          const open = (sched?.shifts ?? []).reduce(
            (n, s) => n + Math.max(0, s.headcount - s.assignments.length),
            0,
          );
          const locRate = fillRate(sched?.shifts ?? []);
          return (
            <Card key={loc.id} hover className="space-y-3">
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
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-surface-container-low px-2 py-2">
                  <p className="font-bold text-primary">{sched?.shifts.length ?? "—"}</p>
                  <p className="text-[10px] uppercase text-outline">Shifts</p>
                </div>
                <div className="rounded-lg bg-surface-container-low px-2 py-2">
                  <p className={cn("font-bold", open ? "text-error" : "text-primary")}>{open}</p>
                  <p className="text-[10px] uppercase text-outline">Open</p>
                </div>
                <div className="rounded-lg bg-surface-container-low px-2 py-2">
                  <p className="font-bold text-primary">{sched ? `${locRate}%` : "—"}</p>
                  <p className="text-[10px] uppercase text-outline">Fill</p>
                </div>
              </div>
              <p className="text-xs text-outline">
                Managers: {loc.managers.map((m) => m.name).join(", ") || "None"}
              </p>
              <Link href="/schedule" className="inline-flex items-center gap-1 text-secondary text-xs font-medium hover:underline">
                <Icon name="calendar_view_week" size={14} />
                Open schedule
              </Link>
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
  return <StaffDashboard />;
}
