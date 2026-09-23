"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import ShiftHistoryPanel from "@/components/ShiftHistoryPanel";
import Drawer, { DrawerCloseButton } from "@/components/ui/Drawer";
import Button from "@/components/ui/Button";
import { AlertBanner, SegmentedControl } from "@/components/ui";
import { toastApiError, toastSuccess } from "@/lib/toast";
import {
  SKILL_LABELS,
  updateShift,
  type Location,
  type ShiftResponse,
  type Skill,
} from "@/lib/api";
import { utcToLocalDate, utcToLocalTime } from "@/lib/shift-time";
import { isDatePast } from "@/lib/schedule-utils";

const SKILLS: Skill[] = ["bartender", "line_cook", "server", "host"];

type Props = {
  open: boolean;
  onClose: () => void;
  shift: ShiftResponse | null;
  location: Location | undefined;
  onUpdated: () => void;
  onAssign?: () => void;
};

export default function EditShiftDrawer({
  open,
  onClose,
  shift,
  location,
  onUpdated,
  onAssign,
}: Props) {
  const qc = useQueryClient();
  const [localDate, setLocalDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [skill, setSkill] = useState<Skill>("server");
  const [headcount, setHeadcount] = useState(1);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"details" | "history">("details");

  useEffect(() => {
    if (!open || !shift || !location) return;
    setLocalDate(utcToLocalDate(shift.starts_at, location.timezone));
    setStartTime(utcToLocalTime(shift.starts_at, location.timezone));
    setEndTime(utcToLocalTime(shift.ends_at, location.timezone));
    setSkill(shift.required_skill);
    setHeadcount(shift.headcount);
    setError("");
    setTab("details");
  }, [open, shift, location]);

  const save = useMutation({
    mutationFn: () => {
      if (!shift || !location) throw new Error("Missing shift or location");
      if (isDatePast(localDate)) throw new Error("Cannot edit shifts on past dates");
      return updateShift(shift.id, {
        version: shift.version,
        local_date: localDate,
        local_start_time: startTime,
        local_end_time: endTime,
        required_skill: skill,
        headcount,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["schedule"] });
      if (shift) void qc.invalidateQueries({ queryKey: ["shift-history", shift.id] });
      toastSuccess("Shift updated");
      onUpdated();
      onClose();
    },
    onError: (err: unknown) => {
      toastApiError(err, "Could not update shift");
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof msg === "string" ? msg : err instanceof Error ? err.message : "Failed to update shift");
    },
  });

  if (!shift || !location) return null;

  const tzLabel = location.timezone.split("/").pop()?.replace("_", " ") ?? "";
  const filled = shift.assignments.length;
  const slotsOpen = shift.headcount - filled;

  const header = (
    <div className="shrink-0 px-5 pt-5 pb-4 border-b border-outline-variant bg-surface-container-low">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-headline-md text-headline-md font-bold text-primary">Edit shift</h2>
          <p className="font-data-mono text-data-mono text-on-surface-variant text-[11px] mt-0.5">
            {location.name} · {filled}/{shift.headcount} assigned
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
        tab === "details" ? (
          <div className="flex gap-2 justify-between w-full">
            <div>
              {slotsOpen > 0 && onAssign && (
                <Button variant="outline" onClick={onAssign}>
                  Assign staff ({slotsOpen} open)
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>
                {save.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end w-full">
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        )
      }
    >
      <div className="p-5 space-y-5">
        <SegmentedControl
          value={tab}
          onChange={(v) => setTab(v as "details" | "history")}
          options={[
            { id: "details", label: "Details" },
            { id: "history", label: "Audit history" },
          ]}
        />

        {tab === "history" ? (
          <ShiftHistoryPanel shiftId={shift.id} timezone={location.timezone} />
        ) : (
          <>
            <AlertBanner
              variant="info"
              icon="info"
              title="Filled shifts can be edited"
              description="Update times, role, or headcount. Headcount cannot drop below current assignments."
            />

            {shift.assignments.length > 0 && (
              <div className="rounded-xl border border-outline-variant p-3 space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-outline font-data-mono">Assigned</p>
                {shift.assignments.map((a) => (
                  <p key={a.id} className="text-sm text-primary font-medium">{a.user_name}</p>
                ))}
              </div>
            )}

            <div>
              <label className="font-data-mono text-[10px] uppercase tracking-wider text-outline">Date</label>
              <input
                type="date"
                value={localDate}
                onChange={(e) => setLocalDate(e.target.value)}
                className="mt-1 w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-data-mono text-[10px] uppercase tracking-wider text-outline">Start ({tzLabel})</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest"
                />
              </div>
              <div>
                <label className="font-data-mono text-[10px] uppercase tracking-wider text-outline">End ({tzLabel})</label>
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
                min={Math.max(1, filled)}
                max={20}
                value={headcount}
                onChange={(e) => setHeadcount(Number(e.target.value))}
                className="mt-1 w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest"
              />
              <p className="text-xs text-on-surface-variant mt-1">Minimum {filled} (current assignments)</p>
            </div>

            {error && <AlertBanner variant="error" title="Could not update shift" description={error} />}
          </>
        )}
      </div>
    </Drawer>
  );
}
