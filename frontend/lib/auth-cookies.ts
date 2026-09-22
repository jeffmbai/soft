import type { UserRole } from "@/lib/api";

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";

const ONE_HOUR = 60 * 60;
const SEVEN_DAYS = 7 * 24 * 60 * 60;

export const accessCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: ONE_HOUR,
};

export const refreshCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SEVEN_DAYS,
};

export function decodeAccessToken(token: string): { role: UserRole; sub: string } | null {
  try {
    const segment = token.split(".")[1];
    if (!segment) return null;
    const payload = JSON.parse(
      Buffer.from(segment.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"),
    ) as { role?: UserRole; sub?: string; type?: string; exp?: number };

    if (payload.type !== "access" || !payload.role || !payload.sub) return null;
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;

    return { role: payload.role, sub: payload.sub };
  } catch {
    return null;
  }
}

export function homePathForRole(role: UserRole): string {
  return role === "staff" ? "/my-schedule" : "/dashboard";
}

export const ROLE_ROUTES: Record<string, UserRole[]> = {
  "/users": ["admin"],
  "/locations": ["admin"],
  "/schedule": ["admin", "manager"],
  "/swaps": ["admin", "manager"],
  "/on-duty": ["admin", "manager"],
  "/dashboard": ["admin", "manager"],
  "/my-schedule": ["staff"],
  "/availability": ["staff"],
  "/open-shifts": ["staff"],
};

export function roleAllowedOnPath(role: UserRole, pathname: string): boolean {
  const allowed = ROLE_ROUTES[pathname];
  if (!allowed) return true;
  return allowed.includes(role);
}
