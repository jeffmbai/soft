import type {
  DutyFloorResponse,
  MyShift,
  ShiftResponse,
  Skill,
  StaffMemberResponse,
} from "@/lib/api";
import { SKILL_LABELS, formatShiftRange } from "@/lib/api";
import { DAY_LABELS } from "@/lib/dashboard-metrics";

export type DrillItem = {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeVariant?: "live" | "warning" | "default";
};

export type DrillAction = {
  href: string;
  label: string;
};

export function dayLabel(dayIndex: number): string {
  return DAY_LABELS[dayIndex] ?? "Day";
}

export function filterShiftsByDay(
  shifts: ShiftResponse[],
  weekStart: string,
  dayIndex: number,
): ShiftResponse[] {
  const ws = new Date(weekStart + "T12:00:00");
  return shifts.filter((s) => {
    const d = new Date(s.starts_at);
    const offset = Math.floor((d.getTime() - ws.getTime()) / 86400000);
    return offset === dayIndex;
  });
}

export function filterShiftsBySkill(shifts: ShiftResponse[], skill: Skill): ShiftResponse[] {
  return shifts.filter((s) => s.required_skill === skill);
}

export function filterShiftsWithGaps(shifts: ShiftResponse[]): ShiftResponse[] {
  return shifts.filter((s) => s.assignments.length < s.headcount);
}

export function filterMyShiftsByDay(
  shifts: MyShift[],
  weekStart: string,
  dayIndex: number,
): MyShift[] {
  const ws = new Date(weekStart + "T12:00:00");
  return shifts.filter((s) => {
    const d = new Date(s.starts_at);
    const offset = Math.floor((d.getTime() - ws.getTime()) / 86400000);
    return offset === dayIndex;
  });
}

export function shiftsToDrillItems(
  shifts: ShiftResponse[],
  timezone: string | Record<string, string>,
): DrillItem[] {
  return shifts.map((s) => {
    const tz = typeof timezone === "string" ? timezone : timezone[s.location_id] ?? "UTC";
    const open = s.headcount - s.assignments.length;
    return {
      id: s.id,
      title: formatShiftRange(s.starts_at, s.ends_at, tz),
      subtitle: SKILL_LABELS[s.required_skill],
      badge: open > 0 ? `${open} open` : `${s.assignments.length}/${s.headcount} filled`,
      badgeVariant: open > 0 ? "warning" : "live",
    };
  });
}

export function myShiftsToDrillItems(shifts: MyShift[]): DrillItem[] {
  return shifts.map((s) => ({
    id: s.assignment_id,
    title: formatShiftRange(s.starts_at, s.ends_at, s.location_timezone),
    subtitle: `${s.location_name} · ${SKILL_LABELS[s.required_skill]}`,
    badge: `${((new Date(s.ends_at).getTime() - new Date(s.starts_at).getTime()) / 3600000).toFixed(1)}h`,
  }));
}

export function staffToDrillItem(staff: StaffMemberResponse | undefined): DrillItem[] {
  if (!staff) return [];
  return [{
    id: staff.id,
    title: staff.name,
    subtitle: staff.skills.map((s) => SKILL_LABELS[s as Skill] ?? s).join(", "),
    badge: `${staff.assigned_hours}h assigned`,
    badgeVariant: staff.assigned_hours >= 35 ? "warning" : "default",
  }];
}

export function skillLabelToKey(label: string): Skill | null {
  const entry = Object.entries(SKILL_LABELS).find(([, v]) => v === label);
  return entry ? (entry[0] as Skill) : null;
}

export function coverageDrillItems(
  floor: DutyFloorResponse | undefined,
  segment: string,
): DrillItem[] {
  if (!floor) return [];

  const tzByLocation = Object.fromEntries(floor.locations.map((l) => [l.location_id, l.timezone]));

  if (segment === "gaps") {
    return floor.shifts
      .filter((s) => s.gaps > 0)
      .map((s) => ({
        id: s.shift_id,
        title: `${s.location_name} · ${SKILL_LABELS[s.skill as Skill] ?? s.skill}`,
        subtitle: formatShiftRange(s.starts_at, s.ends_at, tzByLocation[s.location_id] ?? "UTC"),
        badge: `${s.gaps} gap${s.gaps === 1 ? "" : "s"}`,
        badgeVariant: "warning" as const,
      }));
  }

  const statusMap: Record<string, string> = {
    clocked_in: "clocked_in",
    tardy: "tardy",
    scheduled: "scheduled",
    "On duty": "clocked_in",
    Tardy: "tardy",
    Scheduled: "scheduled",
  };
  const targetStatus = statusMap[segment] ?? segment;

  return floor.shifts.flatMap((shift) =>
    shift.staff
      .filter((m) => m.status === targetStatus)
      .map((m) => ({
        id: `${shift.shift_id}-${m.assignment_id}`,
        title: m.name,
        subtitle: `${shift.location_name} · ${SKILL_LABELS[shift.skill as Skill] ?? shift.skill}`,
        badge: m.status.replace("_", " "),
        badgeVariant: m.status === "tardy" ? ("warning" as const) : ("live" as const),
      })),
  );
}
