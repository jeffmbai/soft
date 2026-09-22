import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  accessCookieOptions,
  refreshCookieOptions,
} from "@/lib/auth-cookies";
import { getBackendUrl } from "@/lib/backend";

export async function POST(request: NextRequest) {
  const body = await request.json();

  const backendRes = await fetch(`${getBackendUrl()}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!backendRes.ok) {
    const error = await backendRes.json().catch(() => ({ detail: "Invalid email or password" }));
    return NextResponse.json(error, { status: backendRes.status });
  }

  const tokens = (await backendRes.json()) as {
    access_token: string;
    refresh_token: string;
  };

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACCESS_COOKIE, tokens.access_token, accessCookieOptions);
  response.cookies.set(REFRESH_COOKIE, tokens.refresh_token, refreshCookieOptions);
  return response;
}
