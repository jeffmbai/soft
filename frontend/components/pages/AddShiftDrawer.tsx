"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import Drawer, { DrawerCloseButton } from "@/components/ui/Drawer";
import Button from "@/components/ui/Button";
import { AlertBanner } from "@/components/ui";
import {
  createShift,
  SKILL_LABELS,
  type Location,
  type Skill,
} from "@/lib/api";
import { addDays, isDatePast, todayIso } from "@/lib/schedule-utils";

const SKILLS: Skill[] = ["bartender", "line_cook", "server", "host"];

type Props = {
  open: boolean;
  onClose: () => void;
  location: Location | undefined;
  weekStart: string;
  prefillDayOffset?: number;
  prefillSkill?: Skill;
  onCreated: () => void;
};

function weekDates(weekStart: string): { iso: string; label: string }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const iso = addDays(weekStart, i);
    const d = new Date(iso + "T12:00:00");
    return {
      iso,
      label: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
    };
  });
}

export default function AddShiftDrawer({
  open,
  onClose,
  location,
  weekStart,
  prefillDayOffset = 0,
  prefillSkill = "server",
  onCreated,
}: Props) {
  const qc = useQueryClient();
  const allDates = useMemo(() => weekDates(weekStart), [weekStart]);
  const dates = useMemo(() => allDates.filter((d) => !isDatePast(d.iso)), [allDates]);

  const [localDate, setLocalDate] = useState(dates[0]?.iso ?? todayIso());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [skill, setSkill] = useState<Skill>(prefillSkill);
  const [headcount, setHeadcount] = useState(1);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const prefillDate = addDays(weekStart, prefillDayOffset);
    const firstAvailable = dates[0]?.iso ?? todayIso();
    setLocalDate(isDatePast(prefillDate) ? firstAvailable : prefillDate);
    setSkill(prefillSkill);
    setError("");
  }, [open, weekStart, prefillDayOffset, prefillSkill, dates]);

  const create = useMutation({
    mutationFn: () => {
      if (!location) throw new Error("No location selected");
      if (isDatePast(localDate)) throw new Error("Cannot create shifts on past dates");
      return createShift(location.id, {
        local_date: localDate,
        local_start_time: startTime,
        local_end_time: endTime,
        required_skill: skill,
        headcount,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule"] });
      onCreated();
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof msg === "string" ? msg : err instanceof Error ? err.message : "Failed to create shift");
    },
  });

  const tzLabel = location?.timezone.split("/").pop()?.replace("_", " ") ?? "";

  const header = (
    <div className="shrink-0 px-5 pt-5 pb-4 border-b border-outline-variant bg-surface-container-low">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-headline-md text-headline-md font-bold text-primary">Add shift</h2>
          <p className="font-data-mono text-data-mono text-on-surface-variant text-[11px] mt-0.5">
            {location?.name ?? "Select a location"} · {tzLabel || "local time"}
          </p>
        </div>
        <DrawerCloseButton onClose={onClose} />
      </div>
    </div>
  );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      header={header}
      footer={
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!location || dates.length === 0 || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? "Creating…" : "Create shift"}
          </Button>
        </div>
      }
    >
      <div className="p-5 space-y-5">
        {dates.length === 0 ? (
          <AlertBanner
            variant="warning"
            title="No future dates this week"
            description="Navigate to the current or a future week to add shifts."
          />
        ) : (
          <>
            {location && (
              <AlertBanner
                variant="info"
                icon="location_on"
                title={location.name}
                description={`Times are in ${tzLabel} (${location.timezone})`}
              />
            )}

            <div>
              <label className="font-data-mono text-[10px] uppercase tracking-wider text-outline">Date</label>
              <select
                className="mt-1 w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest"
                value={localDate}
                onChange={(e) => setLocalDate(e.target.value)}
              >
                {dates.map((d) => (
                  <option key={d.iso} value={d.iso}>{d.label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-data-mono text-[10px] uppercase tracking-wider text-outline">Start</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest"
                />
              </div>
              <div>
                <label className="font-data-mono text-[10px] uppercase tracking-wider text-outline">End</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest"
                />
              </div>
            </div>

            <div>
              <label className="font-data-mono text-[10px] uppercase tracking-wider text-outline">Role required</label>
              <select
                className="mt-1 w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest"
                value={skill}
                onChange={(e) => setSkill(e.target.value as Skill)}
              >
                {SKILLS.map((s) => (
                  <option key={s} value={s}>{SKILL_LABELS[s]}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-data-mono text-[10px] uppercase tracking-wider text-outline">Headcount</label>
              <input
                type="number"
                min={1}
                max={20}
                value={headcount}
                onChange={(e) => setHeadcount(Number(e.target.value))}
                className="mt-1 w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest"
              />
            </div>
          </>
        )}

        {error && <AlertBanner variant="error" title="Could not create shift" description={error} />}
      </div>
    </Drawer>
  );
}
