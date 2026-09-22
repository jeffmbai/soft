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
