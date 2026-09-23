"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button, Card, Icon } from "@/components/ui";
import Loading from "@/components/Loading";
import {
  fetchMyAvailability,
  updateMyAvailability,
  type AvailabilityExceptionInput,
  type AvailabilityWindowInput,
} from "@/lib/api";
import { toastApiError, toastSuccess } from "@/lib/toast";
import { cn } from "@/lib/cn";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const FULL_DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const TIMEZONES = [
  { value: "America/Los_Angeles", label: "Pacific (PT)" },
  { value: "America/New_York", label: "Eastern (ET)" },
  { value: "America/Chicago", label: "Central (CT)" },
  { value: "America/Denver", label: "Mountain (MT)" },
];

const DEFAULT_WINDOW = { start_time: "09:00", end_time: "17:00" };

function formatExceptionDate(date: string) {
  const d = new Date(`${date}T12:00:00`);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function AvailabilityView() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["my-availability"], queryFn: fetchMyAvailability });
  const [windows, setWindows] = useState<AvailabilityWindowInput[] | null>(null);
  const [exceptions, setExceptions] = useState<AvailabilityExceptionInput[] | null>(null);
  const [timezone, setTimezone] = useState("America/Los_Angeles");

  useEffect(() => {
    if (data?.timezone) setTimezone(data.timezone);
  }, [data?.timezone]);

  const activeWindows = windows ?? data?.windows ?? [];
  const activeExceptions = exceptions ?? data?.exceptions ?? [];
  const activeDays = new Set(activeWindows.map((w) => w.day_of_week));
  const sortedWindows = [...activeWindows].sort((a, b) => a.day_of_week - b.day_of_week);

  const save = useMutation({
    mutationFn: () =>
      updateMyAvailability({ timezone, windows: activeWindows, exceptions: activeExceptions }),
    onSuccess: () => {
      setWindows(null);
      setExceptions(null);
      void qc.invalidateQueries({ queryKey: ["my-availability"] });
      toastSuccess("Availability saved");
    },
    onError: (err) => toastApiError(err, "Could not save availability"),
  });

  if (isLoading) return <Loading variant="inline" message="Loading availability…" />;

  const toggleDay = (day: number) => {
    const exists = activeWindows.find((w) => w.day_of_week === day);
    setWindows(
      exists
        ? activeWindows.filter((w) => w.day_of_week !== day)
        : [...activeWindows, { day_of_week: day, ...DEFAULT_WINDOW }],
    );
  };

  const updateWindowTime = (day: number, field: "start_time" | "end_time", value: string) => {
    setWindows(
      activeWindows.map((w) => (w.day_of_week === day ? { ...w, [field]: value } : w)),
    );
  };

  const addException = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const date = tomorrow.toISOString().slice(0, 10);
    setExceptions([
      ...activeExceptions,
      { date, is_available: false, start_time: null, end_time: null },
    ]);
  };

  const updateException = (index: number, patch: Partial<AvailabilityExceptionInput>) => {
    setExceptions(
      activeExceptions.map((ex, i) => (i === index ? { ...ex, ...patch } : ex)),
    );
  };

  const removeException = (index: number) => {
    setExceptions(activeExceptions.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col gap-5 pb-10 max-w-2xl">
      <header className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md font-bold text-slate-900">Availability</h1>
          <p className="text-sm text-slate-600 mt-1">Set your weekly hours, timezone, and one-off date overrides.</p>
        </div>
        <Button variant="primary" size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </header>

      <Card className="p-5 space-y-4 border-slate-200">
        <div>
          <label htmlFor="availability-timezone" className="text-sm font-medium text-slate-900">
            Timezone
          </label>
          <p className="text-xs text-slate-500 mt-0.5">Weekly hours and date overrides use this timezone.</p>
          <select
            id="availability-timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="mt-2 w-full max-w-xs px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>
        </div>
      </Card>

      <Card className="p-5 space-y-5 border-slate-200">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Weekly schedule</h2>
          <p className="text-sm text-slate-600 mt-0.5">Select days you are available, then set start and end times.</p>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {DAY_LABELS.map((label, i) => {
            const on = activeDays.has(i);
            return (
              <button
                key={label}
                type="button"
                onClick={() => toggleDay(i)}
                className={cn(
                  "flex flex-col items-center gap-1.5 py-3 rounded-lg border text-sm font-medium transition-colors",
                  on
                    ? "bg-slate-800 text-white border-slate-800"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50",
                )}
              >
                <span className="text-[10px] font-data-mono uppercase">{label}</span>
                <span className={cn("w-2 h-2 rounded-full", on ? "bg-white" : "bg-slate-300")} />
              </button>
            );
          })}
        </div>

        {sortedWindows.length > 0 ? (
          <div className="space-y-2 pt-1">
            {sortedWindows.map((w) => (
              <div
                key={w.day_of_week}
                className="flex flex-wrap items-center gap-2 sm:gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5"
              >
                <span className="text-sm font-medium text-slate-900 w-24 shrink-0">
                  {FULL_DAY_LABELS[w.day_of_week]}
                </span>
                <input
                  type="time"
                  value={w.start_time}
                  onChange={(e) => updateWindowTime(w.day_of_week, "start_time", e.target.value)}
                  className="px-2 py-1.5 rounded-md border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
                <span className="text-xs text-slate-500">to</span>
                <input
                  type="time"
                  value={w.end_time}
                  onChange={(e) => updateWindowTime(w.day_of_week, "end_time", e.target.value)}
                  className="px-2 py-1.5 rounded-md border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
                <button
                  type="button"
                  onClick={() => toggleDay(w.day_of_week)}
                  className="ml-auto text-xs text-slate-500 hover:text-slate-900"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No days selected.</p>
        )}
      </Card>

      <Card className="p-5 space-y-4 border-slate-200">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Date overrides</h2>
            <p className="text-sm text-slate-600 mt-0.5">
              Block a date or set custom hours for a specific day.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={addException}>
            Add date
          </Button>
        </div>

        {activeExceptions.length === 0 ? (
          <p className="text-sm text-slate-500 flex items-center gap-1.5">
            <Icon name="event" size={16} className="text-slate-400" />
            No date overrides yet.
          </p>
        ) : (
          <div className="space-y-2">
            {activeExceptions.map((ex, index) => (
              <div
                key={`${ex.date}-${index}`}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 space-y-3"
              >
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <input
                    type="date"
                    value={ex.date}
                    onChange={(e) => updateException(index, { date: e.target.value })}
                    className="px-2 py-1.5 rounded-md border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  />
                  <select
                    value={ex.is_available ? "available" : "unavailable"}
                    onChange={(e) => {
                      const isAvailable = e.target.value === "available";
                      updateException(index, {
                        is_available: isAvailable,
                        start_time: isAvailable ? ex.start_time ?? DEFAULT_WINDOW.start_time : null,
                        end_time: isAvailable ? ex.end_time ?? DEFAULT_WINDOW.end_time : null,
                      });
                    }}
                    className="px-2 py-1.5 rounded-md border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  >
                    <option value="unavailable">Unavailable all day</option>
                    <option value="available">Custom hours</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => removeException(index)}
                    className="ml-auto text-xs text-slate-500 hover:text-slate-900"
                  >
                    Remove
                  </button>
                </div>
                {ex.is_available && (
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 pl-0 sm:pl-1">
                    <span className="text-xs text-slate-500">{formatExceptionDate(ex.date)}</span>
                    <input
                      type="time"
                      value={ex.start_time ?? DEFAULT_WINDOW.start_time}
                      onChange={(e) => updateException(index, { start_time: e.target.value })}
                      className="px-2 py-1.5 rounded-md border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                    <span className="text-xs text-slate-500">to</span>
                    <input
                      type="time"
                      value={ex.end_time ?? DEFAULT_WINDOW.end_time}
                      onChange={(e) => updateException(index, { end_time: e.target.value })}
                      className="px-2 py-1.5 rounded-md border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
