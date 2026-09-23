import axios from "axios";

export const api = axios.create({
  baseURL: "/api/proxy",
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

export type UserRole = "admin" | "manager" | "staff";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export async function login(email: string, password: string): Promise<void> {
  await axios.post("/api/auth/login", { email, password }, { withCredentials: true });
}

export async function logout(): Promise<void> {
  await axios.post("/api/auth/logout", {}, { withCredentials: true });
}

export async function fetchMe(): Promise<User> {
  const { data } = await axios.get<User>("/api/auth/me", { withCredentials: true });
  return data;
}

export interface Location {
  id: string;
  name: string;
  timezone: string;
  address: string;
}

export async function fetchLocations(): Promise<Location[]> {
  const { data } = await api.get<Location[]>("/locations");
  return data;
}

export type ManagerBrief = {
  id: string;
  name: string;
  email: string;
};

export type LocationOverview = Location & {
  managers: ManagerBrief[];
};

export async function fetchLocationsOverview(): Promise<LocationOverview[]> {
  const { data } = await api.get<LocationOverview[]>("/locations/overview");
  return data;
}

export async function fetchManagers(): Promise<ManagerBrief[]> {
  const { data } = await api.get<ManagerBrief[]>("/locations/managers");
  return data;
}

export async function setLocationManagers(
  locationId: string,
  managerIds: string[],
): Promise<LocationOverview> {
  const { data } = await api.put<LocationOverview>(`/locations/${locationId}/managers`, {
    manager_ids: managerIds,
  });
  return data;
}

export type StaffLocationBrief = {
  id: string;
  name: string;
  timezone: string;
};

export type StaffMemberResponse = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  desired_hours_per_week: number | null;
  assigned_hours: number;
  skills: string[];
  locations: StaffLocationBrief[];
  availability_summary: string;
  availability_hours: string;
  availability_timezone: string;
};

export type StaffListParams = {
  q?: string;
  skill?: string;
  location_id?: string;
  certification?: "single" | "multi";
};

export type StaffCreatePayload = {
  email: string;
  name: string;
  password?: string;
  desired_hours_per_week: number;
  availability_timezone: string;
  skills: string[];
  location_ids: string[];
};

export type StaffUpdatePayload = Partial<StaffCreatePayload>;

export async function fetchStaff(params?: StaffListParams): Promise<StaffMemberResponse[]> {
  const { data } = await api.get<StaffMemberResponse[]>("/staff", { params: cleanParams(params) });
  return data;
}

export async function createStaff(payload: StaffCreatePayload): Promise<StaffMemberResponse> {
  const { data } = await api.post<StaffMemberResponse>("/staff", payload);
  return data;
}

export async function updateStaff(id: string, payload: StaffUpdatePayload): Promise<StaffMemberResponse> {
  const { data } = await api.patch<StaffMemberResponse>(`/staff/${id}`, payload);
  return data;
}

export async function deleteStaff(id: string): Promise<void> {
  await api.delete(`/staff/${id}`);
}

export async function exportStaffCsv(params?: StaffListParams): Promise<Blob> {
  const { data } = await api.get<Blob>("/staff/export", {
    params: cleanParams(params),
    responseType: "blob",
  });
  return data;
}

function cleanParams(params?: StaffListParams): StaffListParams | undefined {
  if (!params) return undefined;
  const out: StaffListParams = {};
  if (params.q?.trim()) out.q = params.q.trim();
  if (params.skill) out.skill = params.skill;
  if (params.location_id) out.location_id = params.location_id;
  if (params.certification) out.certification = params.certification;
  return Object.keys(out).length ? out : undefined;
}


// --- Scheduling ---

export type Skill = "bartender" | "line_cook" | "server" | "host";
export type ShiftStatus = "draft" | "published";

export interface AssignmentBrief {
  id: string;
  user_id: string;
  user_name: string;
  status: string;
}

export interface ShiftResponse {
  id: string;
  location_id: string;
  starts_at: string;
  ends_at: string;
  required_skill: Skill;
  headcount: number;
  status: ShiftStatus;
  version: number;
  assignments: AssignmentBrief[];
}

export interface ScheduleWeekResponse {
  location_id: string;
  week_start: string;
  published_at: string | null;
  is_published: boolean;
  shifts: ShiftResponse[];
}

export interface Violation {
  rule: string;
  message: string;
  severity: "error" | "warning";
}

export interface Suggestion {
  user_id: string;
  name: string;
  reason: string;
}

export interface AssignResult {
  success: boolean;
  assignment_id: string | null;
  violations: Violation[];
  suggestions: Suggestion[];
}

export interface MyShift {
  assignment_id: string;
  shift_id: string;
  location_id: string;
  location_name: string;
  location_timezone: string;
  starts_at: string;
  ends_at: string;
  required_skill: Skill;
  status: ShiftStatus;
}

export interface AvailabilityWindowInput {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface AvailabilityExceptionInput {
  date: string;
  is_available: boolean;
  start_time?: string | null;
  end_time?: string | null;
}

export interface AvailabilityData {
  timezone: string;
  windows: AvailabilityWindowInput[];
  exceptions: AvailabilityExceptionInput[];
}

export async function fetchSchedule(locationId: string, week: string): Promise<ScheduleWeekResponse> {
  const { data } = await api.get<ScheduleWeekResponse>(`/locations/${locationId}/schedule`, {
    params: { week },
  });
  return data;
}

export type ShiftCreatePayload = {
  required_skill: Skill;
  headcount: number;
  starts_at?: string;
  ends_at?: string;
  local_date?: string;
  local_start_time?: string;
  local_end_time?: string;
};

export async function createShift(
  locationId: string,
  payload: ShiftCreatePayload,
): Promise<ShiftResponse> {
  const { data } = await api.post<ShiftResponse>(`/locations/${locationId}/shifts`, payload);
  return data;
}

export async function assignShift(shiftId: string, userId: string, overrideReason?: string): Promise<AssignResult> {
  const { data } = await api.post<AssignResult>(`/shifts/${shiftId}/assign`, {
    user_id: userId,
    override_reason: overrideReason ?? null,
  });
  return data;
}

export async function previewAssign(shiftId: string, userId: string): Promise<AssignResult> {
  const { data } = await api.post<AssignResult>(`/shifts/${shiftId}/assign/preview`, { user_id: userId });
  return data;
}

export async function unassign(assignmentId: string): Promise<void> {
  await api.delete(`/assignments/${assignmentId}`);
}

export async function publishWeek(locationId: string, weekStart: string): Promise<void> {
  await api.post(`/locations/${locationId}/weeks/${weekStart}/publish`);
}

export async function unpublishWeek(locationId: string, weekStart: string): Promise<void> {
  await api.post(`/locations/${locationId}/weeks/${weekStart}/unpublish`);
}

export async function fetchMyShifts(options?: { week?: string; upcoming?: boolean }): Promise<MyShift[]> {
  const params: Record<string, string | boolean> = {};
  if (options?.week) params.week = options.week;
  if (options?.upcoming) params.upcoming = true;
  const { data } = await api.get<MyShift[]>("/my/shifts", {
    params: Object.keys(params).length ? params : undefined,
  });
  return data;
}

export async function fetchMyAvailability(): Promise<AvailabilityData> {
  const { data } = await api.get<AvailabilityData>("/me/availability");
  return data;
}

export async function updateMyAvailability(payload: AvailabilityData): Promise<AvailabilityData> {
  const { data } = await api.put<AvailabilityData>("/me/availability", payload);
  return data;
}

export const SKILL_LABELS: Record<Skill, string> = {
  bartender: "Bartender",
  line_cook: "Line Cook",
  server: "Server",
  host: "Host",
};

export function formatShiftRange(startsAt: string, endsAt: string, timezone: string): string {
  const opts: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  };
  const fmt = new Intl.DateTimeFormat("en-US", opts);
  const tzShort = timezone.split("/").pop()?.replace("_", " ") ?? timezone;
  return `${fmt.format(new Date(startsAt))} – ${fmt.format(new Date(endsAt))} ${tzShort}`;
}

export function mondayOfWeek(d = new Date()): string {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date.toISOString().slice(0, 10);
}

export function addWeeks(isoDate: string, weeks: number): string {
  const d = new Date(isoDate + "T12:00:00");
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

// --- Swaps & notifications ---

export type SwapType = "swap" | "drop";
export type SwapStatus =
  | "pending_counterparty"
  | "pending_manager"
  | "approved"
  | "cancelled"
  | "expired"
  | "superseded";

export interface SwapUserBrief {
  id: string;
  name: string;
}

export interface SwapShiftBrief {
  shift_id: string;
  location_id: string;
  location_name: string;
  location_timezone: string;
  starts_at: string;
  ends_at: string;
  required_skill: string;
}

export interface SwapRequestResponse {
  id: string;
  type: SwapType;
  status: SwapStatus;
  expires_at: string | null;
  created_at: string;
  requester: SwapUserBrief;
  target: SwapUserBrief | null;
  shift: SwapShiftBrief;
  can_accept: boolean;
  can_approve: boolean;
  can_cancel: boolean;
  can_claim: boolean;
  claim_block_reason: string | null;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  payload: Record<string, string> | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationPreferences {
  in_app: boolean;
  email_sim: boolean;
}

export async function fetchSwapRequests(): Promise<SwapRequestResponse[]> {
  const { data } = await api.get<SwapRequestResponse[]>("/swap-requests");
  return data;
}

export async function fetchOpenShifts(): Promise<SwapRequestResponse[]> {
  const { data } = await api.get<SwapRequestResponse[]>("/open-shifts");
  return data;
}

export async function createSwapRequest(payload: {
  assignment_id: string;
  type: SwapType;
  target_user_id?: string;
}): Promise<SwapRequestResponse> {
  const { data } = await api.post<SwapRequestResponse>("/swap-requests", payload);
  return data;
}

export async function acceptSwap(swapId: string): Promise<SwapRequestResponse> {
  const { data } = await api.post<SwapRequestResponse>(`/swap-requests/${swapId}/accept`);
  return data;
}

export async function approveSwap(swapId: string): Promise<SwapRequestResponse> {
  const { data } = await api.post<SwapRequestResponse>(`/swap-requests/${swapId}/approve`);
  return data;
}

export async function cancelSwap(swapId: string): Promise<SwapRequestResponse> {
  const { data } = await api.post<SwapRequestResponse>(`/swap-requests/${swapId}/cancel`);
  return data;
}

export async function claimOpenShift(swapId: string): Promise<{ assignment_id: string; shift_id: string }> {
  const { data } = await api.post<{ assignment_id: string; shift_id: string }>(
    `/swap-requests/${swapId}/claim`,
  );
  return data;
}

export async function fetchNotifications(): Promise<NotificationItem[]> {
  const { data } = await api.get<NotificationItem[]>("/me/notifications");
  return data;
}

export async function markNotificationRead(id: string): Promise<NotificationItem> {
  const { data } = await api.post<NotificationItem>(`/me/notifications/${id}/read`);
  return data;
}

export async function fetchNotificationPreferences(): Promise<NotificationPreferences> {
  const { data } = await api.get<NotificationPreferences>("/me/notification-preferences");
  return data;
}

export async function updateNotificationPreferences(
  payload: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  const { data } = await api.patch<NotificationPreferences>("/me/notification-preferences", payload);
  return data;
}

export type DutyStaffStatus = "scheduled" | "clocked_in" | "tardy" | "clocked_out";

export interface DutyStaffMember {
  assignment_id: string;
  user_id: string;
  name: string;
  initials: string;
  skill: string;
  shift_starts_at: string;
  shift_ends_at: string;
  status: DutyStaffStatus;
  clocked_in_at: string | null;
  can_clock_in: boolean;
  can_clock_out: boolean;
}

export interface DutyShiftGroup {
  shift_id: string;
  location_id: string;
  location_name: string;
  skill: string;
  starts_at: string;
  ends_at: string;
  headcount: number;
  assigned: number;
  gaps: number;
  staff: DutyStaffMember[];
}

export interface DutyLocationSummary {
  location_id: string;
  name: string;
  timezone: string;
  scheduled_count: number;
  clocked_in_count: number;
  tardy_count: number;
  gap_count: number;
  active_shifts: number;
}

export interface DutyActivityItem {
  id: string;
  at: string;
  label: string;
  tone: "ok" | "warn" | "error" | "neutral";
}

export interface DutyFloorResponse {
  updated_at: string;
  total_clocked_in: number;
  locations: DutyLocationSummary[];
  shifts: DutyShiftGroup[];
  activity: DutyActivityItem[];
}

export interface DutySummaryResponse {
  total_clocked_in: number;
  total_scheduled: number;
  total_tardy: number;
  total_gaps: number;
  active_shifts: number;
}

export async function fetchDutyFloor(): Promise<DutyFloorResponse> {
  const { data } = await api.get<DutyFloorResponse>("/duty/floor");
  return data;
}

export async function fetchDutySummary(): Promise<DutySummaryResponse> {
  const { data } = await api.get<DutySummaryResponse>("/duty/summary");
  return data;
}

export async function fetchDutyWsToken(): Promise<{ token: string; expires_in: number }> {
  const { data } = await api.post<{ token: string; expires_in: number }>("/duty/ws-token");
  return data;
}

export async function dutyClockIn(assignmentId: string): Promise<void> {
  await api.post("/duty/clock-in", { assignment_id: assignmentId });
}

export async function dutyClockOut(assignmentId: string): Promise<void> {
  await api.post("/duty/clock-out", { assignment_id: assignmentId });
}

export const SWAP_STATUS_LABELS: Record<SwapStatus, string> = {
  pending_counterparty: "Awaiting peer",
  pending_manager: "Awaiting manager",
  approved: "Approved / open",
  cancelled: "Cancelled",
  expired: "Expired",
  superseded: "Superseded",
};
