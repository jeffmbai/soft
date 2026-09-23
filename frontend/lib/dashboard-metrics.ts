import type { ScheduleWeekResponse, ShiftResponse, StaffMemberResponse } from "@/lib/api";
import { SKILL_LABELS, type Skill } from "@/lib/api";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export type ChartDatum = {
  name: string;
  value: number;
  fill?: string;
  id?: string;
  meta?: Record<string, unknown>;
};

export { DAY_LABELS };

export function shiftsByDay(schedule: ScheduleWeekResponse | undefined, weekStart: string): ChartDatum[] {
  const counts = Array(7).fill(0) as number[];
  if (!schedule) return DAY_LABELS.map((name) => ({ name, value: 0 }));

  const ws = new Date(weekStart + "T12:00:00");
  for (const shift of schedule.shifts) {
    const d = new Date(shift.starts_at);
    const offset = Math.floor((d.getTime() - ws.getTime()) / 86400000);
    if (offset >= 0 && offset < 7) counts[offset]++;
  }
  return DAY_LABELS.map((name, i) => ({
    name,
    value: counts[i],
    id: String(i),
    meta: { dayIndex: i },
  }));
}

export function openSlotsByLocation(
  locations: { id: string; name: string }[],
  schedules: Record<string, ScheduleWeekResponse | undefined>,
): ChartDatum[] {
  return locations.map((loc) => {
    const shifts = schedules[loc.id]?.shifts ?? [];
    const open = shifts.reduce((n, s) => n + Math.max(0, s.headcount - s.assignments.length), 0);
    return {
      name: loc.name.split(" ")[0] ?? loc.name,
      value: open,
      id: loc.id,
      meta: { locationId: loc.id, fullName: loc.name },
    };
  });
}

export function staffHoursChart(staff: StaffMemberResponse[], limit = 8): ChartDatum[] {
  return [...staff]
    .sort((a, b) => b.assigned_hours - a.assigned_hours)
    .slice(0, limit)
    .map((s) => ({
      name: s.name.split(" ")[0] ?? s.name,
      value: Math.round(s.assigned_hours * 10) / 10,
      id: s.id,
      meta: { staffId: s.id, fullName: s.name },
    }));
}

export function skillMix(shifts: ShiftResponse[]): ChartDatum[] {
  const counts: Partial<Record<Skill, number>> = {};
  for (const s of shifts) {
    counts[s.required_skill] = (counts[s.required_skill] ?? 0) + 1;
  }
  return (Object.entries(counts) as [Skill, number][]).map(([skill, value]) => ({
    name: SKILL_LABELS[skill],
    value,
    id: skill,
    meta: { skill },
  }));
}

export function fillRate(shifts: ShiftResponse[]): number {
  if (!shifts.length) return 0;
  const total = shifts.reduce((n, s) => n + s.headcount, 0);
  const filled = shifts.reduce((n, s) => n + s.assignments.length, 0);
  return total ? Math.round((filled / total) * 100) : 0;
}

export function shiftHours(startsAt: string, endsAt: string): number {
  return (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 3600000;
}

export function totalScheduledHours(shifts: ShiftResponse[]): number {
  return Math.round(shifts.reduce((acc, s) => acc + shiftHours(s.starts_at, s.ends_at) * s.headcount, 0));
}

export function myHoursByDay(
  shifts: { starts_at: string; ends_at: string }[],
  weekStart: string,
): ChartDatum[] {
  const hours = Array(7).fill(0) as number[];
  const ws = new Date(weekStart + "T12:00:00");
  for (const shift of shifts) {
    const d = new Date(shift.starts_at);
    const offset = Math.floor((d.getTime() - ws.getTime()) / 86400000);
    if (offset >= 0 && offset < 7) hours[offset] += shiftHours(shift.starts_at, shift.ends_at);
  }
  return DAY_LABELS.map((name, i) => ({
    name,
    value: Math.round(hours[i] * 10) / 10,
    id: String(i),
    meta: { dayIndex: i },
  }));
}

export const CHART_COLORS = ["#006a61", "#131b2e", "#3980f4", "#6bd8cb", "#76777d", "#ba1a1a", "#f59e0b"];
