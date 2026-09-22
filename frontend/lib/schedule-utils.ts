export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isDatePast(iso: string): boolean {
  return iso < todayIso();
}

export function isShiftPast(startsAt: string): boolean {
  return new Date(startsAt).getTime() <= Date.now();
}

export function shiftHours(startsAt: string, endsAt: string): number {
  return (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 3600000;
}

export function hoursLeft(desired: number | null, assigned: number): number {
  const cap = desired ?? 40;
  return Math.max(0, cap - assigned);
}
