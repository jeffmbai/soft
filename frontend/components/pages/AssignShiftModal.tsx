"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  AlertBanner,
  Avatar,
  Badge,
  Button,
  Icon,
} from "@/components/ui";
import Loading from "@/components/Loading";
import {
  assignShift,
  fetchStaff,
  formatShiftRange,
  previewAssign,
  SKILL_LABELS,
  type AssignResult,
  type ShiftResponse,
} from "@/lib/api";
import { hoursLeft, isShiftPast, shiftHours } from "@/lib/schedule-utils";
import { initials } from "@/lib/staff-utils";
import { cn } from "@/lib/cn";

type Props = {
  shift: ShiftResponse;
  timezone: string;
  locationId: string;
  onClose: () => void;
  onAssigned: () => void;
};

export default function AssignShiftModal({
  shift,
  timezone,
  locationId,
  onClose,
  onAssigned,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<AssignResult | null>(null);
  const past = isShiftPast(shift.starts_at);

  const assignedIds = useMemo(
    () => new Set(shift.assignments.map((a) => a.user_id)),
    [shift.assignments],
  );

  const { data: staff, isLoading, isError } = useQuery({
    queryKey: ["staff", shift.required_skill, locationId],
    queryFn: () =>
      fetchStaff({ skill: shift.required_skill, location_id: locationId }),
    enabled: !past && !!locationId,
  });

  const candidates = useMemo(
    () => (staff ?? []).filter((s) => !assignedIds.has(s.id)),
    [staff, assignedIds],
  );

  const duration = shiftHours(shift.starts_at, shift.ends_at);

  useEffect(() => {
    if (!selectedId || past) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    previewAssign(shift.id, selectedId).then((res) => {
      if (!cancelled) setPreview(res);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedId, shift.id, past]);

  const assign = useMutation({
    mutationFn: () => assignShift(shift.id, selectedId!),
    onSuccess: (res) => {
      if (res.success) {
        onAssigned();
        onClose();
      } else {
        setPreview(res);
      }
    },
  });

  const roleLabel = SKILL_LABELS[shift.required_skill];
  const canAssign =
    !past &&
    !!selectedId &&
    (preview?.success ?? false) &&
    !assign.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-primary/25 backdrop-blur-[2px] p-0 sm:p-4">
      <div
        className="w-full sm:max-w-lg max-h-[90vh] flex flex-col bg-surface-container-lowest border border-outline-variant sm:rounded-2xl shadow-2xl overflow-hidden"
        role="dialog"
        aria-labelledby="assign-shift-title"
      >
        <div className="shrink-0 px-5 pt-5 pb-4 border-b border-outline-variant bg-surface-container-low">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <Badge variant="secondary">{roleLabel}</Badge>
                {past && <Badge variant="warning">Past shift</Badge>}
                <span className="text-xs text-on-surface-variant font-data-mono">
                  {duration.toFixed(1)}h slot
                </span>
              </div>
              <h2 id="assign-shift-title" className="font-headline-md text-headline-md font-bold text-primary">
                Assign shift
              </h2>
              <p className="text-sm text-on-surface-variant mt-1">
                {formatShiftRange(shift.starts_at, shift.ends_at, timezone)}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-2 rounded-xl text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors"
            >
              <Icon name="close" size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {past ? (
            <AlertBanner
              variant="warning"
              title="Shift is in the past"
              description="Staff cannot be assigned to shifts that have already started."
            />
          ) : (
            <>
              <p className="text-sm font-medium text-primary">
                {roleLabel}s at this location
                <span className="text-on-surface-variant font-normal">
                  {" "}· pick someone with hours remaining
                </span>
              </p>

              {isLoading ? (
                <Loading variant="inline" message="Loading staff…" />
              ) : isError ? (
                <AlertBanner
                  variant="error"
                  title="Could not load staff"
                  description="Try closing and reopening the modal. If the problem persists, refresh the page."
                />
              ) : candidates.length === 0 ? (
                <AlertBanner
                  variant="info"
                  icon="group_off"
                  title={`No available ${roleLabel.toLowerCase()}s`}
                  description="No staff with this role at this location, or all are already assigned."
                />
              ) : (
                <ul className="space-y-2">
                  {candidates.map((member) => {
                    const left = hoursLeft(member.desired_hours_per_week, member.assigned_hours);
                    const selected = selectedId === member.id;
                    return (
                      <li key={member.id}>
                        <button
                          type="button"
                          disabled={left <= 0}
                          onClick={() => setSelectedId(member.id)}
                          className={cn(
                            "w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors",
                            left <= 0 && "opacity-50 cursor-not-allowed",
                            selected
                              ? "border-secondary bg-secondary/8 ring-1 ring-secondary/30"
                              : "border-outline-variant bg-surface hover:border-secondary/40 hover:bg-surface-container-low",
                          )}
                        >
                          <Avatar initials={initials(member.name)} size="md" variant="secondary" />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-primary truncate">{member.name}</div>
                            <div className="text-xs text-on-surface-variant truncate">
                              {member.availability_summary}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div
                              className={cn(
                                "font-data-mono text-sm font-bold",
                                left <= 4 ? "text-warning" : "text-secondary",
                              )}
                            >
                              {left.toFixed(0)}h left
                            </div>
                            <div className="text-[10px] text-outline font-data-mono">
                              {member.assigned_hours}h / {member.desired_hours_per_week ?? 40}h
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {selectedId && preview && !preview.success && (
                <div className="space-y-2">
                  {preview.violations.map((v, i) => (
                    <AlertBanner
                      key={i}
                      variant={v.severity === "error" ? "error" : "warning"}
                      title={v.rule}
                      description={v.message}
                    />
                  ))}
                </div>
              )}

              {selectedId && preview?.success && (
                <AlertBanner
                  variant="info"
                  icon="check_circle"
                  title="Ready to assign"
                  description="This staff member passes all scheduling rules for this shift."
                />
              )}
            </>
          )}
        </div>

        <div className="shrink-0 flex gap-2 justify-end p-4 border-t border-outline-variant bg-surface-container-lowest">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {!past && (
            <Button
              variant="primary"
              disabled={!canAssign}
              onClick={() => assign.mutate()}
            >
              {assign.isPending ? "Assigning…" : "Assign to shift"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
