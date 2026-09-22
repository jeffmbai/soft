import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_COOKIE } from "@/lib/auth-cookies";
import { getBackendUrl } from "@/lib/backend";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE)?.value;

  if (!token) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const backendRes = await fetch(`${getBackendUrl()}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const data = await backendRes.json().catch(() => ({ detail: "Unauthorized" }));
  return NextResponse.json(data, { status: backendRes.status });
}
