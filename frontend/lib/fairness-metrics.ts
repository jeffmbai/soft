import type { ShiftResponse, StaffMemberResponse } from "@/lib/api";
import { shiftHours } from "@/lib/dashboard-metrics";

/** Friday/Saturday shifts starting at or after 5pm local time. */
export function isPremiumShift(startsAt: string, timezone: string): boolean {
  const { dow, hour } = localWeekdayHour(startsAt, timezone);
  return (dow === 5 || dow === 6) && hour >= 17;
}

function localWeekdayHour(iso: string, timezone: string): { dow: number; hour: number } {
  const date = new Date(iso);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(date);
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hour12: false }).format(date),
  );
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { dow: map[weekday] ?? 0, hour };
}

export type StaffFairnessRow = {
  id: string;
  name: string;
  totalHours: number;
  premiumShifts: number;
  desiredHours: number;
  hoursDelta: number;
  premiumShare: number;
};

export type FairnessReport = {
  score: number;
  totalPremiumSlots: number;
  staffRows: StaffFairnessRow[];
  underScheduled: StaffFairnessRow[];
  overScheduled: StaffFairnessRow[];
};

export function computeFairnessReport(
  shifts: ShiftResponse[],
  staff: StaffMemberResponse[],
  timezoneOrResolver: string | ((shift: ShiftResponse) => string),
): FairnessReport {
  const tzFor =
    typeof timezoneOrResolver === "function"
      ? timezoneOrResolver
      : () => timezoneOrResolver;

  const premiumByUser = new Map<string, number>();
  let totalPremiumSlots = 0;

  for (const shift of shifts) {
    if (!isPremiumShift(shift.starts_at, tzFor(shift))) continue;
    totalPremiumSlots += shift.assignments.length;
    for (const a of shift.assignments) {
      premiumByUser.set(a.user_id, (premiumByUser.get(a.user_id) ?? 0) + 1);
    }
  }

  const staffRows: StaffFairnessRow[] = staff.map((s) => {
    const premiumShifts = premiumByUser.get(s.id) ?? 0;
    const desiredHours = s.desired_hours_per_week ?? 0;
    const hoursDelta = s.assigned_hours - desiredHours;
    const premiumShare = totalPremiumSlots > 0 ? (premiumShifts / totalPremiumSlots) * 100 : 0;
    return {
      id: s.id,
      name: s.name,
      totalHours: s.assigned_hours,
      premiumShifts,
      desiredHours,
      hoursDelta,
      premiumShare,
    };
  });

  const assignedPremium = staffRows.filter((r) => r.premiumShifts > 0);
  let score = 100;
  if (assignedPremium.length > 1 && totalPremiumSlots > 0) {
    const counts = assignedPremium.map((r) => r.premiumShifts);
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.reduce((acc, c) => acc + (c - mean) ** 2, 0) / counts.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
    score = Math.max(0, Math.round(100 - cv * 100));
  } else if (totalPremiumSlots > 0 && assignedPremium.length <= 1) {
    score = assignedPremium.length === 1 ? 60 : 40;
  }

  return {
    score,
    totalPremiumSlots,
    staffRows: [...staffRows].sort((a, b) => b.premiumShifts - a.premiumShifts),
    underScheduled: staffRows.filter((r) => r.desiredHours > 0 && r.hoursDelta < -2),
    overScheduled: staffRows.filter((r) => r.desiredHours > 0 && r.hoursDelta > 2),
  };
}

export function premiumShiftsInWeek(shifts: ShiftResponse[], timezone: string): ShiftResponse[] {
  return shifts.filter((s) => isPremiumShift(s.starts_at, timezone));
}

export function totalPremiumHours(shifts: ShiftResponse[], timezone: string): number {
  return premiumShiftsInWeek(shifts, timezone).reduce(
    (acc, s) => acc + shiftHours(s.starts_at, s.ends_at) * s.assignments.length,
    0,
  );
}
