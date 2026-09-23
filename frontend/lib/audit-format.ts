import type { AuditLogEntry } from "@/lib/api";

const ENTITY_LABELS: Record<string, string> = {
  shift: "Shift",
  assignment: "Assignment",
  swap_request: "Swap request",
  schedule_week: "Schedule week",
};

function describeState(entityType: string, state: Record<string, unknown> | null): string {
  if (!state) return "";
  if (entityType === "shift") {
    const parts: string[] = [];
    if (state.skill) parts.push(String(state.skill).replace("_", " "));
    if (state.starts_at) parts.push(new Date(String(state.starts_at)).toLocaleString());
    if (state.headcount != null) parts.push(`headcount ${state.headcount}`);
    if (state.version != null) parts.push(`v${state.version}`);
    return parts.join(" · ") || JSON.stringify(state);
  }
  if (entityType === "assignment") {
    if (state.user_name) return String(state.user_name);
    if (state.user_id) return `user ${String(state.user_id).slice(0, 8)}…`;
  }
  if (entityType === "swap_request") {
    const parts: string[] = [];
    if (state.type) parts.push(String(state.type));
    if (state.status) parts.push(String(state.status).replace(/_/g, " "));
    if (state.reason) parts.push(String(state.reason).replace(/_/g, " "));
    return parts.join(" · ");
  }
  if (entityType === "schedule_week") {
    if (state.week_start) return `week of ${state.week_start}${state.shifts != null ? ` · ${state.shifts} shifts` : ""}`;
  }
  return Object.entries(state)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
}

export function formatAuditEntry(entry: AuditLogEntry): { label: string; detail?: string; tone: "ok" | "warn" | "error" | "neutral" } {
  const entity = ENTITY_LABELS[entry.entity_type] ?? entry.entity_type;
  const before = entry.before_state as Record<string, unknown> | null;
  const after = entry.after_state as Record<string, unknown> | null;

  if (entry.entity_type === "shift" && !before && after) {
    return { label: `${entity} created`, detail: describeState("shift", after), tone: "ok" };
  }
  if (entry.entity_type === "shift" && before && after) {
    return {
      label: `${entity} updated`,
      detail: `${describeState("shift", before)} → ${describeState("shift", after)}`,
      tone: "neutral",
    };
  }
  if (entry.entity_type === "assignment" && after) {
    return { label: "Staff assigned", detail: describeState("assignment", after), tone: "ok" };
  }
  if (entry.entity_type === "schedule_week" && after) {
    return { label: "Week published", detail: describeState("schedule_week", after), tone: "ok" };
  }
  if (entry.entity_type === "swap_request") {
    const status = String(after?.status ?? before?.status ?? "");
    if (status.includes("superseded")) {
      return { label: "Swap superseded", detail: describeState("swap_request", after ?? before), tone: "warn" };
    }
    if (status.includes("approved")) {
      return { label: "Swap approved", detail: describeState("swap_request", after ?? before), tone: "ok" };
    }
    if (status.includes("cancelled")) {
      return { label: "Swap cancelled", detail: describeState("swap_request", after ?? before), tone: "neutral" };
    }
    return { label: "Swap request", detail: describeState("swap_request", after ?? before), tone: "neutral" };
  }

  return {
    label: entity,
    detail: after ? describeState(entry.entity_type, after) : before ? describeState(entry.entity_type, before) : undefined,
    tone: "neutral",
  };
}

export function formatAuditTime(iso: string, timezone?: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });
}
