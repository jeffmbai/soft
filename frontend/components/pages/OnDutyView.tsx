"use client";

import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import Loading from "@/components/Loading";
import { Avatar, Badge, Button, Card, Icon } from "@/components/ui";
import { useDutyFloor } from "@/hooks/useDutyFloor";
import {
  dutyClockIn,
  dutyClockOut,
  formatShiftRange,
  SKILL_LABELS,
  type DutyLocationSummary,
  type DutyShiftGroup,
  type DutyStaffMember,
  type Skill,
} from "@/lib/api";
import { tzAbbrev } from "@/lib/staff-utils";
import { cn } from "@/lib/cn";
import { toastApiError, toastSuccess } from "@/lib/toast";

const STATUS_META: Record<
  DutyStaffMember["status"],
  { label: string; className: string }
> = {
  clocked_in: { label: "On duty", className: "bg-slate-800 text-white border-slate-800" },
  scheduled: { label: "Awaiting", className: "bg-white text-slate-600 border-slate-200" },
  tardy: { label: "Tardy", className: "bg-slate-200 text-slate-900 border-slate-300" },
  clocked_out: { label: "Out", className: "bg-white text-slate-500 border-slate-200" },
};

function CoverageRing({ clocked, scheduled }: { clocked: number; scheduled: number }) {
  const pct = scheduled > 0 ? Math.round((clocked / scheduled) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="relative w-10 h-10 shrink-0">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          <circle cx="18" cy="18" r="15" fill="none" stroke="#e2e8f0" strokeWidth="3" />
          <circle
            cx="18"
            cy="18"
            r="15"
            fill="none"
            stroke="#1e293b"
            strokeWidth="3"
            strokeDasharray={`${pct} 100`}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-700">
          {pct}%
        </span>
      </div>
      <div className="text-xs text-slate-600">
        <p className="font-medium text-slate-900">{clocked} clocked in</p>
        <p>{scheduled} scheduled</p>
      </div>
    </div>
  );
}

function StaffCard({
  person,
  timezone,
  loading,
  onClockIn,
  onClockOut,
}: {
  person: DutyStaffMember;
  timezone: string;
  loading: boolean;
  onClockIn: () => void;
  onClockOut: () => void;
}) {
  const meta = STATUS_META[person.status];
  const skill = person.skill as Skill;

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <Avatar initials={person.initials} size="sm" variant="default" />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-medium text-slate-900 truncate">{person.name}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded border border-slate-200 text-slate-500">
            {SKILL_LABELS[skill] ?? person.skill}
          </span>
          <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", meta.className)}>
            {meta.label}
          </span>
        </div>
        <p className="text-[11px] text-slate-500 mt-0.5 truncate">
          {person.clocked_in_at
            ? `In at ${new Date(person.clocked_in_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: timezone })}`
            : formatShiftRange(person.shift_starts_at, person.shift_ends_at, timezone)}
        </p>
      </div>
      <div className="flex gap-1 shrink-0">
        {person.can_clock_in && (
          <Button variant="primary" size="sm" disabled={loading} onClick={onClockIn}>
            In
          </Button>
        )}
        {person.can_clock_out && (
          <Button variant="outline" size="sm" disabled={loading} onClick={onClockOut}>
            Out
          </Button>
        )}
      </div>
    </div>
  );
}

function LocationPanel({
  location,
  shifts,
  loadingId,
  onClockIn,
  onClockOut,
}: {
  location: DutyLocationSummary;
  shifts: DutyShiftGroup[];
  loadingId: string | null;
  onClockIn: (id: string) => void;
  onClockOut: (id: string) => void;
}) {
  const attention = shifts.flatMap((s) =>
    s.staff.filter((p) => p.status === "tardy" || p.status === "scheduled"),
  );
  const onDuty = shifts.flatMap((s) => s.staff.filter((p) => p.status === "clocked_in"));
  const totalGaps = shifts.reduce((n, s) => n + s.gaps, 0);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold text-slate-900">{location.name}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{tzAbbrev(location.timezone)} · {location.active_shifts} active shift{location.active_shifts !== 1 ? "s" : ""}</p>
        </div>
        <CoverageRing clocked={location.clocked_in_count} scheduled={location.scheduled_count} />
      </div>

      {(location.tardy_count > 0 || totalGaps > 0) && (
        <div className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-800">
          <p className="font-medium flex items-center gap-2">
            <Icon name="priority_high" size={16} />
            Needs attention
          </p>
          <p className="text-xs text-slate-600 mt-1">
            {location.tardy_count > 0 && `${location.tardy_count} not clocked in after start`}
            {location.tardy_count > 0 && totalGaps > 0 && " · "}
            {totalGaps > 0 && `${totalGaps} open roster slot${totalGaps > 1 ? "s" : ""}`}
            {(location.tardy_count > 0 || totalGaps > 0) && (
              <>
                {" · "}
                <Link href="/schedule" className="underline hover:text-slate-900">Adjust schedule</Link>
              </>
            )}
          </p>
        </div>
      )}

      {shifts.length === 0 ? (
        <Card className="py-8 text-center border-dashed border-slate-200">
          <p className="text-slate-700 font-medium">No shifts running at this location</p>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            Shifts appear here when published and within their scheduled window (15 min early clock-in allowed).
          </p>
        </Card>
      ) : (
        shifts.map((shift) => {
          const skill = shift.skill as Skill;
          return (
            <Card key={shift.shift_id} className="border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{SKILL_LABELS[skill] ?? shift.skill}</p>
                  <p className="text-xs text-slate-500">
                    {formatShiftRange(shift.starts_at, shift.ends_at, location.timezone)}
                  </p>
                </div>
                <Badge variant="outline" mono className="text-[10px]">
                  {shift.assigned}/{shift.headcount} filled
                </Badge>
              </div>
              <div className="px-4 py-1">
                {shift.staff.map((person) => (
                  <StaffCard
                    key={person.assignment_id}
                    person={person}
                    timezone={location.timezone}
                    loading={loadingId === person.assignment_id}
                    onClockIn={() => onClockIn(person.assignment_id)}
                    onClockOut={() => onClockOut(person.assignment_id)}
                  />
                ))}
                {shift.gaps > 0 &&
                  Array.from({ length: shift.gaps }).map((_, i) => (
                    <div
                      key={`gap-${shift.shift_id}-${i}`}
                      className="py-2.5 border-b border-slate-100 last:border-0 text-xs text-slate-500 flex items-center gap-2"
                    >
                      <Icon name="person_off" size={16} className="text-slate-400" />
                      Unfilled slot — assign from schedule or open pool
                    </div>
                  ))}
              </div>
            </Card>
          );
        })
      )}

      {onDuty.length > 0 && attention.length === 0 && totalGaps === 0 && (
        <p className="text-xs text-slate-500 text-center">All scheduled staff are on duty.</p>
      )}
    </div>
  );
}

export default function OnDutyView() {
  const queryClient = useQueryClient();
  const { floor, isLoading, connected } = useDutyFloor();
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const locations = floor?.locations ?? [];

  useEffect(() => {
    if (!floor || selectedLocationId) return;
    const withActivity = floor.locations.find((l) => l.active_shifts > 0);
    setSelectedLocationId(withActivity?.location_id ?? floor.locations[0]?.location_id ?? "");
  }, [floor, selectedLocationId]);

  const clockMutation = useMutation({
    mutationFn: async ({ action, assignmentId }: { action: "in" | "out"; assignmentId: string }) => {
      setLoadingId(assignmentId);
      if (action === "in") await dutyClockIn(assignmentId);
      else await dutyClockOut(assignmentId);
    },
    onSuccess: (_, { action }) => {
      toastSuccess(action === "in" ? "Clocked in" : "Clocked out");
      void queryClient.invalidateQueries({ queryKey: ["duty-floor"] });
      void queryClient.invalidateQueries({ queryKey: ["duty-summary"] });
    },
    onError: (err) => toastApiError(err, "Clock action failed"),
    onSettled: () => setLoadingId(null),
  });

  const locationShifts = useMemo(() => {
    if (!floor || !selectedLocationId) return [];
    return floor.shifts.filter((s) => s.location_id === selectedLocationId);
  }, [floor, selectedLocationId]);

  const selectedLocation = locations.find((l) => l.location_id === selectedLocationId);

  if (isLoading) return <Loading variant="inline" message="Loading live floor…" />;

  const totalTardy = locations.reduce((n, l) => n + l.tardy_count, 0);
  const totalGaps = locations.reduce((n, l) => n + l.gap_count, 0);

  return (
    <div className="flex flex-col gap-5 pb-10 max-w-6xl">
      <header className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <h1 className="font-headline-md text-headline-md font-bold text-slate-900">Live Floor & Duty</h1>
            <p className="text-sm text-slate-600 mt-1">
              Shows <strong className="font-medium text-slate-800">published shifts happening now</strong> — who is
              scheduled, who has clocked in, and open roster slots. Updates live via WebSocket.
            </p>
          </div>
          <div
            className={cn(
              "flex items-center gap-2 text-xs rounded-lg px-3 py-2 border",
              connected ? "bg-white border-slate-200 text-slate-700" : "bg-slate-100 border-slate-200 text-slate-500",
            )}
          >
            <span className="relative flex h-2 w-2">
              {connected && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-400 opacity-75" />
              )}
              <span className={cn("relative rounded-full h-2 w-2", connected ? "bg-slate-800" : "bg-slate-300")} />
            </span>
            {connected ? "Live" : "Reconnecting…"}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {[
            { label: "Clocked in", value: floor?.total_clocked_in ?? 0 },
            { label: "Scheduled now", value: locations.reduce((n, l) => n + l.scheduled_count, 0) },
            { label: "Tardy", value: totalTardy, alert: totalTardy > 0 },
            { label: "Open slots", value: totalGaps, alert: totalGaps > 0 },
          ].map((s) => (
            <div
              key={s.label}
              className={cn(
                "rounded-lg border px-3 py-2.5 bg-white",
                s.alert ? "border-slate-400" : "border-slate-200",
              )}
            >
              <p className="text-lg font-bold text-slate-900">{s.value}</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-data-mono">{s.label}</p>
            </div>
          ))}
        </div>
      </header>

      {floor?.shifts.length === 0 && (
        <Card className="py-10 px-6 text-center border-dashed border-slate-200">
          <Icon name="schedule" size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-900 font-medium">Nothing on the floor right now</p>
          <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
            This view only includes <strong>published</strong> shifts whose start/end window includes the current
            time. Publish a week in Schedule with shifts covering now to see live coverage.
          </p>
          <Link href="/schedule">
            <Button variant="outline" size="sm" className="mt-4">
              Go to Schedule
            </Button>
          </Link>
        </Card>
      )}

      <div className="flex flex-col lg:flex-row gap-5">
        <aside className="lg:w-56 shrink-0 space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-data-mono px-1 mb-2">Locations</p>
          {locations.map((loc) => (
            <button
              key={loc.location_id}
              type="button"
              onClick={() => setSelectedLocationId(loc.location_id)}
              className={cn(
                "w-full text-left rounded-lg px-3 py-2.5 border transition-colors",
                selectedLocationId === loc.location_id
                  ? "border-slate-800 bg-slate-800 text-white"
                  : "border-slate-200 bg-white hover:bg-slate-50 text-slate-900",
              )}
            >
              <p className="text-sm font-medium truncate">{loc.name}</p>
              <p
                className={cn(
                  "text-[11px] mt-0.5",
                  selectedLocationId === loc.location_id ? "text-slate-300" : "text-slate-500",
                )}
              >
                {loc.clocked_in_count}/{loc.scheduled_count} on floor
                {loc.active_shifts === 0 && " · idle"}
              </p>
            </button>
          ))}
        </aside>

        <div className="flex-1 min-w-0">
          {selectedLocation ? (
            <LocationPanel
              location={selectedLocation}
              shifts={locationShifts}
              loadingId={loadingId}
              onClockIn={(id) => clockMutation.mutate({ action: "in", assignmentId: id })}
              onClockOut={(id) => clockMutation.mutate({ action: "out", assignmentId: id })}
            />
          ) : (
            <Card className="py-8 text-center border-slate-200">
              <p className="text-slate-500 text-sm">Select a location</p>
            </Card>
          )}
        </div>

        <aside className="lg:w-52 shrink-0">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-data-mono px-1 mb-2">Clock activity</p>
          <Card className="p-3 border-slate-200">
            {!floor?.activity.length ? (
              <p className="text-xs text-slate-500">No clock events yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {floor.activity.map((item) => (
                  <li key={`${item.id}-${item.at}`} className="text-xs">
                    <span className="font-data-mono text-slate-400 block">
                      {new Date(item.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </span>
                    <span className="text-slate-700">{item.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
