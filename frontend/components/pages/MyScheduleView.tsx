"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, ConfirmationModal, Icon } from "@/components/ui";
import Loading from "@/components/Loading";
import {
  createSwapRequest,
  dutyClockIn,
  dutyClockOut,
  fetchMyShifts,
  formatShiftRange,
  SKILL_LABELS,
  type MyShift,
} from "@/lib/api";
import { liveQueryOptions, SCHEDULE_QUERY_MS } from "@/lib/live-query";
import { formatDuration } from "@/lib/shift-time";
import { toastApiError, toastSuccess } from "@/lib/toast";

function shiftHours(startsAt: string, endsAt: string): string {
  return `${((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 3600000).toFixed(1)}h`;
}

function formatDay(startsAt: string, timezone: string) {
  const d = new Date(startsAt);
  return {
    weekday: d.toLocaleDateString("en-US", { weekday: "short", timeZone: timezone }),
    day: d.toLocaleDateString("en-US", { day: "numeric", timeZone: timezone }),
    month: d.toLocaleDateString("en-US", { month: "short", timeZone: timezone }),
  };
}

function LiveShiftPanel({ shift, onRefresh }: { shift: MyShift; onRefresh: () => void }) {
  const duty = shift.duty;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!duty?.is_active) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [duty?.is_active]);

  const clockMutation = useMutation({
    mutationFn: async (action: "in" | "out") => {
      if (action === "in") await dutyClockIn(shift.assignment_id);
      else await dutyClockOut(shift.assignment_id);
    },
    onSuccess: (_, action) => {
      toastSuccess(action === "in" ? "Clocked in — shift started" : "Clocked out");
      onRefresh();
    },
    onError: (err) => toastApiError(err, "Clock action failed"),
  });

  const onShift = duty?.seconds_on_shift ?? 0;
  const elapsedDisplay = duty?.clocked_in_at
    ? onShift + tick
    : onShift;
  const breakIn = duty?.seconds_until_break != null ? Math.max(0, duty.seconds_until_break - tick) : null;
  const shiftEndIn = duty?.seconds_until_shift_end != null ? Math.max(0, duty.seconds_until_shift_end - tick) : null;

  return (
    <Card className="p-5 border-slate-300 bg-slate-50 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-data-mono uppercase text-slate-500 tracking-wider">On shift now</p>
          <h2 className="font-semibold text-slate-900 mt-0.5">{shift.location_name}</h2>
          <p className="text-sm text-slate-600">{formatShiftRange(shift.starts_at, shift.ends_at, shift.location_timezone)}</p>
        </div>
        <Badge variant="outline" className="bg-white">
          {duty?.duty_status === "clocked_in" ? "On duty" : duty?.duty_status === "tardy" ? "Tardy — clock in" : "Active shift"}
        </Badge>
      </div>

      {duty?.duty_status === "clocked_in" && (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-white border border-slate-200 px-3 py-2 text-center">
            <p className="text-lg font-bold text-slate-900 font-data-mono">{formatDuration(elapsedDisplay)}</p>
            <p className="text-[10px] uppercase text-slate-500">Time on shift</p>
          </div>
          <div className="rounded-lg bg-white border border-slate-200 px-3 py-2 text-center">
            <p className="text-lg font-bold text-slate-900 font-data-mono">
              {duty.break_available ? "Due" : breakIn != null ? formatDuration(breakIn) : "—"}
            </p>
            <p className="text-[10px] uppercase text-slate-500">Until break</p>
          </div>
          <div className="rounded-lg bg-white border border-slate-200 px-3 py-2 text-center">
            <p className="text-lg font-bold text-slate-900 font-data-mono">
              {shiftEndIn != null ? formatDuration(shiftEndIn) : "—"}
            </p>
            <p className="text-[10px] uppercase text-slate-500">Shift ends</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {duty?.can_clock_in && (
          <Button
            variant="primary"
            size="sm"
            disabled={clockMutation.isPending}
            onClick={() => clockMutation.mutate("in")}
          >
            Clock in to shift
          </Button>
        )}
        {duty?.can_clock_out && (
          <Button
            variant="outline"
            size="sm"
            disabled={clockMutation.isPending}
            onClick={() => clockMutation.mutate("out")}
          >
            Clock out
          </Button>
        )}
        {duty?.break_available && duty.duty_status === "clocked_in" && (
          <span className="text-xs text-slate-600 flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white border border-slate-200">
            <Icon name="free_breakfast" size={14} />
            Break available (4h+ on shift)
          </span>
        )}
      </div>
    </Card>
  );
}

export default function MyScheduleView() {
  const queryClient = useQueryClient();
  const [pendingDrop, setPendingDrop] = useState<MyShift | null>(null);

  const { data: shifts, isLoading, refetch } = useQuery({
    queryKey: ["my-shifts", "upcoming"],
    queryFn: () => fetchMyShifts({ upcoming: true }),
    refetchInterval: (query) => {
      const list = query.state.data ?? [];
      const hasActive = list.some((s) => s.duty?.is_active);
      return hasActive ? 10_000 : SCHEDULE_QUERY_MS;
    },
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const activeShift = useMemo(
    () => (shifts ?? []).find((s) => s.duty?.is_active),
    [shifts],
  );

  const upcomingShifts = useMemo(
    () => (shifts ?? []).filter((s) => !s.duty?.is_active),
    [shifts],
  );

  const dropMutation = useMutation({
    mutationFn: (assignmentId: string) => createSwapRequest({ assignment_id: assignmentId, type: "drop" }),
    onSuccess: () => {
      setPendingDrop(null);
      toastSuccess("Drop request submitted", "Your manager will be notified to approve.");
      void queryClient.invalidateQueries({ queryKey: ["my-shifts"] });
      void queryClient.invalidateQueries({ queryKey: ["swap-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (err) => { toastApiError(err, "Could not submit drop"); setPendingDrop(null); },
  });

  const refresh = () => {
    void refetch();
    void queryClient.invalidateQueries({ queryKey: ["duty-floor"] });
    void queryClient.invalidateQueries({ queryKey: ["duty-summary"] });
  };

  if (isLoading) return <Loading variant="inline" message="Loading your schedule…" />;

  const totalHours = (shifts ?? []).reduce(
    (acc, s) => acc + (new Date(s.ends_at).getTime() - new Date(s.starts_at).getTime()) / 3600000,
    0,
  );

  return (
    <div className="flex flex-col gap-5 pb-10 max-w-3xl">
      <header className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md font-bold text-slate-900">My Schedule</h1>
          <p className="text-sm text-slate-600 mt-1">Clock in when your shift starts · break due after 4 hours</p>
        </div>
        <div className="flex gap-3">
          <div className="rounded-lg bg-white border border-slate-200 px-4 py-2 text-center min-w-[72px]">
            <p className="text-xl font-bold text-slate-900">{shifts?.length ?? 0}</p>
            <p className="text-[10px] font-data-mono uppercase text-slate-500">Shifts</p>
          </div>
          <div className="rounded-lg bg-white border border-slate-200 px-4 py-2 text-center min-w-[72px]">
            <p className="text-xl font-bold text-slate-900">{totalHours.toFixed(1)}</p>
            <p className="text-[10px] font-data-mono uppercase text-slate-500">Hours</p>
          </div>
        </div>
      </header>

      {activeShift && <LiveShiftPanel shift={activeShift} onRefresh={refresh} />}

      {!shifts?.length ? (
        <Card className="py-14 text-center border-dashed border-slate-200">
          <Icon name="event_busy" size={28} className="text-slate-400 mx-auto mb-3" />
          <p className="font-medium text-slate-900">No upcoming shifts</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {upcomingShifts.length > 0 && (
            <p className="text-sm font-semibold text-slate-900 px-1">Upcoming</p>
          )}
          {upcomingShifts.map((s) => {
            const isFuture = new Date(s.starts_at) > new Date();
            const day = formatDay(s.starts_at, s.location_timezone);
            return (
              <article key={s.assignment_id} className="rounded-xl border border-slate-200 bg-white p-4 flex gap-4 items-center">
                <div className="shrink-0 w-18 py-2 rounded-lg bg-slate-50 border border-slate-200 flex flex-col items-center">
                  <span className="text-[9px] font-data-mono uppercase text-slate-500">{day.weekday}</span>
                  <span className="text-2xl font-bold text-slate-900 leading-none">{day.day}</span>
                  <span className="text-[9px] font-data-mono text-slate-500">{day.month}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h2 className="font-semibold text-slate-900">{s.location_name}</h2>
                    <Badge variant="outline">{SKILL_LABELS[s.required_skill]}</Badge>
                  </div>
                  <p className="text-sm text-slate-600">{formatShiftRange(s.starts_at, s.ends_at, s.location_timezone)}</p>
                  <p className="text-xs text-slate-500 font-data-mono mt-1">{shiftHours(s.starts_at, s.ends_at)}</p>
                </div>
                {isFuture && (
                  <Button variant="outline" size="sm" className="shrink-0" onClick={() => setPendingDrop(s)}>Drop</Button>
                )}
              </article>
            );
          })}
        </div>
      )}

      {pendingDrop && (
        <ConfirmationModal
          open
          title="Request to drop this shift?"
          description="Your manager will be notified to approve. You remain scheduled until then."
          confirmLabel="Submit drop request"
          variant="danger"
          icon="exit_to_app"
          loading={dropMutation.isPending}
          onClose={() => !dropMutation.isPending && setPendingDrop(null)}
          onConfirm={() => dropMutation.mutate(pendingDrop.assignment_id)}
        >
          <div className="space-y-1 text-sm">
            <p className="font-semibold text-slate-900">{pendingDrop.location_name}</p>
            <p className="text-slate-600">{formatShiftRange(pendingDrop.starts_at, pendingDrop.ends_at, pendingDrop.location_timezone)}</p>
          </div>
        </ConfirmationModal>
      )}
    </div>
  );
}
