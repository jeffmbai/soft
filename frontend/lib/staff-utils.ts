import type { StaffMemberResponse } from "@/lib/api";

export type StaffMemberUI = {
  id: string;
  initials: string;
  name: string;
  email: string;
  role: string;
  primary: string;
  secondary: string | null;
  skills: string[];
  hours: string;
  goal: string;
  delta: string;
  progress: number;
  cap: string;
  headroom: string;
  availability: string;
  hoursRange: string;
  otRisk?: boolean;
  phone: string;
  equity: string;
  locationIds: string[];
  desiredHours: number;
  availabilityTimezone: string;
  skillKeys: string[];
};

const SKILL_TO_KEY: Record<string, string> = {
  Bartender: "bartender",
  "Line Cook": "line_cook",
  Server: "server",
  Host: "host",
};

export function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function tzAbbrev(timezone: string) {
  if (timezone.includes("Los_Angeles") || timezone.includes("Pacific")) return "PT";
  if (timezone.includes("New_York") || timezone.includes("Eastern")) return "ET";
  return timezone.split("/").pop()?.replace("_", " ") ?? timezone;
}

export function toStaffMemberUI(row: StaffMemberResponse): StaffMemberUI {
  const desired = row.desired_hours_per_week ?? 0;
  const assigned = row.assigned_hours;
  const delta = assigned - desired;
  const progress = desired > 0 ? (assigned / desired) * 100 : 0;
  const otRisk = assigned > 38;

  const primary = row.locations[0];
  const secondary = row.locations[1] ?? null;

  return {
    id: row.id,
    initials: initials(row.name),
    name: row.name,
    email: row.email,
    role: row.skills[0] ?? "Staff",
    primary: primary ? `${primary.name} (${tzAbbrev(primary.timezone)})` : "—",
    secondary: secondary ? `${secondary.name} (${tzAbbrev(secondary.timezone)})` : null,
    skills: row.skills,
    hours: `${assigned}h`,
    goal: `${desired}h`,
    delta: delta >= 0 ? `+${delta.toFixed(0)}h` : `${delta.toFixed(0)}h`,
    progress,
    cap: "40h/wk",
    headroom: `${Math.max(0, 40 - assigned).toFixed(1)}h headroom`,
    availability: row.availability_summary,
    hoursRange: row.availability_hours,
    otRisk,
    phone: "—",
    equity: desired > 0 ? `${Math.min((assigned / desired) * 100, 999).toFixed(1)}%` : "—",
    locationIds: row.locations.map((l) => l.id),
    desiredHours: desired,
    availabilityTimezone: row.availability_timezone,
    skillKeys: row.skills.map((s) => SKILL_TO_KEY[s] ?? s),
  };
}

export const SKILL_OPTIONS = [
  { value: "", label: "All Skills" },
  { value: "bartender", label: "Bartender" },
  { value: "line_cook", label: "Line Cook" },
  { value: "server", label: "Server" },
  { value: "host", label: "Host" },
];

export const CERT_OPTIONS = [
  { value: "", label: "All Certification" },
  { value: "single", label: "Single Location" },
  { value: "multi", label: "Cross-Certified" },
];
