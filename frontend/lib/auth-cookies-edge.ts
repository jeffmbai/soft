import type { UserRole } from "@/lib/api";

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";

export function decodeAccessToken(token: string): { role: UserRole; sub: string } | null {
  try {
    const segment = token.split(".")[1];
    if (!segment) return null;
    const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const json =
      typeof atob !== "undefined"
        ? atob(base64)
        : Buffer.from(base64, "base64").toString("utf8");
    const payload = JSON.parse(json) as {
      role?: UserRole;
      sub?: string;
      type?: string;
      exp?: number;
    };

    if (payload.type !== "access" || !payload.role || !payload.sub) return null;
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;

    return { role: payload.role, sub: payload.sub };
  } catch {
    return null;
  }
}

export function homePathForRole(_role: UserRole): string {
  return "/dashboard";
}

export const ROLE_ROUTES: Record<string, UserRole[]> = {
  "/users": ["admin"],
  "/locations": ["admin"],
  "/schedule": ["admin", "manager"],
  "/swaps": ["admin", "manager"],
  "/on-duty": ["admin", "manager"],
  "/audit": ["admin", "manager"],
  "/dashboard": ["admin", "manager", "staff"],
  "/my-schedule": ["staff"],
  "/availability": ["staff"],
  "/open-shifts": ["admin", "manager", "staff"],
};

export function roleAllowedOnPath(role: UserRole, pathname: string): boolean {
  const allowed = ROLE_ROUTES[pathname];
  if (!allowed) return true;
  return allowed.includes(role);
}
