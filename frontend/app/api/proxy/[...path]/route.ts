import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  accessCookieOptions,
  refreshCookieOptions,
} from "@/lib/auth-cookies";
import { getBackendUrl } from "@/lib/backend";

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const res = await fetch(`${getBackendUrl()}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) return null;
  const tokens = (await res.json()) as { access_token: string; refresh_token: string };
  return tokens.access_token;
}

async function forward(
  request: NextRequest,
  pathSegments: string[],
  accessToken: string,
): Promise<Response> {
  const url = `${getBackendUrl()}/api/${pathSegments.join("/")}${request.nextUrl.search}`;
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${accessToken}`);
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: "no-store",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.text();
  }

  return fetch(url, init);
}

async function handle(request: NextRequest, pathSegments: string[]) {
  const cookieStore = await cookies();
  let accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;

  if (!accessToken) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  let backendRes = await forward(request, pathSegments, accessToken);

  if (backendRes.status === 401 && refreshToken) {
    const newAccess = await refreshAccessToken(refreshToken);
    if (newAccess) {
      accessToken = newAccess;
      backendRes = await forward(request, pathSegments, accessToken);
      const body = await backendRes.text();
      const response = new NextResponse(body, {
        status: backendRes.status,
        headers: { "Content-Type": backendRes.headers.get("Content-Type") || "application/json" },
      });
      response.cookies.set(ACCESS_COOKIE, newAccess, accessCookieOptions);
      return response;
    }
  }

  const body = await backendRes.text();
  return new NextResponse(body, {
    status: backendRes.status,
    headers: { "Content-Type": backendRes.headers.get("Content-Type") || "application/json" },
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return handle(request, path);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return handle(request, path);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return handle(request, path);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return handle(request, path);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return handle(request, path);
}
