"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import AddShiftDrawer from "@/components/pages/AddShiftDrawer";
import AssignShiftModal from "@/components/pages/AssignShiftModal";
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  Icon,
  PageHeader,
} from "@/components/ui";
import Loading from "@/components/Loading";
import { useScheduleUiStore } from "@/stores/scheduleUiStore";
import {
  addWeeks,
  fetchLocations,
  fetchSchedule,
  formatShiftRange,
  mondayOfWeek,
  publishWeek,
  SKILL_LABELS,
  type ShiftResponse,
  type Skill,
} from "@/lib/api";
import { addDays, isDatePast, isShiftPast } from "@/lib/schedule-utils";
import { cn } from "@/lib/cn";
import { liveQueryOptions, SCHEDULE_QUERY_MS } from "@/lib/live-query";
import { toastApiError, toastSuccess } from "@/lib/toast";

const SKILLS: Skill[] = ["bartender", "line_cook", "server", "host"];

function weekDayHeaders(weekStart: string): { short: string; date: string; iso: string; past: boolean }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const iso = addDays(weekStart, i);
    const d = new Date(iso + "T12:00:00");
    return {
      iso,
      short: d.toLocaleDateString("en-US", { weekday: "short" }),
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      past: isDatePast(iso),
    };
  });
}

function shiftDayIndex(startsAt: string, weekStart: string): number {
  const d = new Date(startsAt);
  const ws = new Date(weekStart + "T12:00:00");
  return Math.floor((d.getTime() - ws.getTime()) / 86400000);
}

export default function ScheduleView() {
  const qc = useQueryClient();
  const addShiftOpen = useScheduleUiStore((s) => s.addShiftOpen);
  const prefill = useScheduleUiStore((s) => s.prefill);
  const openAddShift = useScheduleUiStore((s) => s.openAddShift);
  const closeAddShift = useScheduleUiStore((s) => s.closeAddShift);
  const requestPublish = useScheduleUiStore((s) => s.requestPublish);
  const clearPublishRequest = useScheduleUiStore((s) => s.clearPublishRequest);

  const [weekStart, setWeekStart] = useState(mondayOfWeek());
  const [locationId, setLocationId] = useState<string>("");
  const [assignShiftTarget, setAssignShiftTarget] = useState<ShiftResponse | null>(null);

  const dayHeaders = useMemo(() => weekDayHeaders(weekStart), [weekStart]);

  const { data: locations, isLoading: locLoading } = useQuery({
    queryKey: ["locations"],
    queryFn: fetchLocations,
  });

  const activeLocationId = locationId || locations?.[0]?.id || "";
  const activeLocation = locations?.find((l) => l.id === activeLocationId);

  const { data: schedule, isLoading: schedLoading } = useQuery({
    queryKey: ["schedule", activeLocationId, weekStart],
    queryFn: () => fetchSchedule(activeLocationId, weekStart),
    enabled: !!activeLocationId,
    ...liveQueryOptions(SCHEDULE_QUERY_MS),
  });

  const publish = useMutation({
    mutationFn: () => publishWeek(activeLocationId, weekStart),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["schedule", activeLocationId, weekStart] });
      toastSuccess("Week published", "Staff can now see their shifts.");
    },
    onError: (err) => toastApiError(err, "Could not publish week"),
  });

  useEffect(() => {
    if (!requestPublish || !activeLocationId) return;
    publish.mutate();
    clearPublishRequest();
  }, [requestPublish, activeLocationId, clearPublishRequest]); // eslint-disable-line react-hooks/exhaustive-deps

  const shiftsBySkillDay = useMemo(() => {
    const map: Record<string, Record<number, ShiftResponse[]>> = {};
    for (const skill of SKILLS) map[skill] = {};
    for (const shift of schedule?.shifts ?? []) {
      const day = shiftDayIndex(shift.starts_at, weekStart);
      if (day < 0 || day > 6) continue;
      if (!map[shift.required_skill][day]) map[shift.required_skill][day] = [];
      map[shift.required_skill][day].push(shift);
    }
    return map;
  }, [schedule, weekStart]);

  const totalShifts = schedule?.shifts.length ?? 0;
  const openSlots = (schedule?.shifts ?? []).reduce(
    (acc, s) => acc + Math.max(0, s.headcount - s.assignments.length),
    0,
  );

  const invalidateSchedule = () =>
    qc.invalidateQueries({ queryKey: ["schedule", activeLocationId, weekStart] });

  if (locLoading) return <Loading variant="inline" message="Loading locations…" />;

  return (
    <div className="flex flex-col gap-space-lg pb-24">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader title={`Week of ${weekStart}`} description={activeLocation?.name} />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setWeekStart(addWeeks(weekStart, -1))}>Prev</Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(mondayOfWeek())}>Today</Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>Next</Button>
          <Button
            variant="primary"
            size="sm"
            disabled={publish.isPending || !activeLocationId}
            onClick={() => publish.mutate()}
          >
            {schedule?.is_published ? "Re-publish" : "Publish week"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex gap-2 flex-wrap items-center">
          {locations?.map((loc) => (
            <button
              key={loc.id}
              type="button"
              onClick={() => setLocationId(loc.id)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-sm border transition-colors",
                loc.id === activeLocationId
                  ? "bg-secondary text-on-secondary border-secondary"
                  : "border-outline-variant hover:border-secondary/50",
              )}
            >
              {loc.name}
            </button>
          ))}
          {schedule?.is_published ? (
            <Badge variant="live">Published</Badge>
          ) : (
            <Badge variant="warning">Draft</Badge>
          )}
          {!schedLoading && totalShifts > 0 && (
            <span className="text-xs text-on-surface-variant font-data-mono">
              {totalShifts} shifts · {openSlots} open slots
            </span>
          )}
        </div>
        <Button
          variant="primary"
          size="sm"
          disabled={!activeLocationId}
          onClick={() => openAddShift()}
          className="shrink-0"
        >
          <Icon name="add" size={18} />
          Add shift
        </Button>
      </div>

      {!schedLoading && totalShifts === 0 && (
        <AlertBanner
          variant="info"
          icon="event_available"
          title="No shifts this week"
          description="Create your first shift to start building the schedule."
          actions={[{ label: "Add shift", onClick: () => openAddShift(), variant: "primary" }]}
        />
      )}

      {schedLoading ? (
        <Loading variant="inline" message="Loading schedule…" />
      ) : (
        <Card padding={false} className="overflow-x-auto">
          <div className="grid grid-cols-[140px_repeat(7,1fr)] min-w-[980px] border-b border-outline-variant bg-surface-container-low">
            <div className="p-3 border-r border-outline-variant font-semibold text-sm">Role</div>
            {dayHeaders.map((d) => (
              <div
                key={d.iso}
                className={cn(
                  "p-2 text-center border-r border-outline-variant last:border-r-0",
                  d.past && "opacity-60",
                )}
              >
                <div className="text-sm font-semibold">{d.short}</div>
                <div className="text-[11px] text-on-surface-variant font-data-mono">{d.date}</div>
              </div>
            ))}
          </div>
          {SKILLS.map((skill) => (
            <div
              key={skill}
              className="grid grid-cols-[140px_repeat(7,1fr)] min-w-[980px] border-b border-outline-variant divide-x divide-outline-variant"
            >
              <div className="p-3 bg-surface-container-lowest text-sm font-semibold flex items-start">
                {SKILL_LABELS[skill]}
              </div>
              {dayHeaders.map((dayHeader, day) => {
                const cellShifts = shiftsBySkillDay[skill][day] ?? [];
                const isEmpty = cellShifts.length === 0;
                const dayPast = dayHeader.past;
                return (
                  <div
                    key={day}
                    role={!dayPast ? "button" : undefined}
                    tabIndex={!dayPast ? 0 : undefined}
                    onClick={() => !dayPast && openAddShift({ dayOffset: day, skill })}
                    onKeyDown={(e) => {
                      if (!dayPast && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        openAddShift({ dayOffset: day, skill });
                      }
                    }}
                    className={cn(
                      "p-2 flex flex-col gap-1.5 min-h-[110px] transition-colors",
                      (isEmpty || dayPast) && "bg-surface-container-low/40",
                      dayPast && "opacity-70",
                      !dayPast && "cursor-pointer hover:bg-secondary/5",
                      isEmpty && !dayPast && "border border-dashed border-transparent hover:border-secondary/40",
                    )}
                  >
                    {cellShifts.map((shift) => {
                      const filled = shift.assignments.length;
                      const total = shift.headcount;
                      const full = filled >= total;
                      const past = isShiftPast(shift.starts_at);
                      const canAssign = !past && !full;
                      return (
                        <button
                          key={shift.id}
                          type="button"
                          disabled={!canAssign}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (canAssign) setAssignShiftTarget(shift);
                          }}
                          className={cn(
                            "text-left p-2 rounded-xl border text-xs transition-colors",
                            past && "opacity-60 cursor-not-allowed border-outline-variant/50 bg-surface-container-low",
                            !past && full && "border-secondary/30 bg-secondary/5",
                            !past && !full && "border-outline-variant bg-surface hover:border-secondary cursor-pointer",
                          )}
                        >
                          <div className="font-data-mono">
                            {activeLocation &&
                              formatShiftRange(shift.starts_at, shift.ends_at, activeLocation.timezone)}
                          </div>
                          <div className={cn("mt-1 font-medium", past ? "text-outline" : full ? "text-secondary" : "text-warning")}>
                            {past ? "Past" : `${filled}/${total} filled`}
                          </div>
                          {shift.assignments.map((a) => (
                            <div key={a.id} className="text-primary font-medium truncate">{a.user_name}</div>
                          ))}
                        </button>
                      );
                    })}
                    {isEmpty && !dayPast && (
                      <div className="flex-1 flex items-center justify-center text-xs text-on-surface-variant font-medium min-h-[72px]">
                        Click to add shift
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </Card>
      )}

      <AddShiftDrawer
        open={addShiftOpen}
        onClose={closeAddShift}
        location={activeLocation}
        weekStart={weekStart}
        prefillDayOffset={prefill?.dayOffset ?? 0}
        prefillSkill={prefill?.skill ?? "server"}
        onCreated={invalidateSchedule}
      />

      {assignShiftTarget && activeLocation && (
        <AssignShiftModal
          shift={assignShiftTarget}
          timezone={activeLocation.timezone}
          locationId={activeLocationId}
          onClose={() => setAssignShiftTarget(null)}
          onAssigned={invalidateSchedule}
        />
      )}
    </div>
  );
}
