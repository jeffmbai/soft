import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  decodeAccessToken,
  homePathForRole,
  roleAllowedOnPath,
} from "@/lib/auth-cookies-edge";

const PUBLIC_PATHS = new Set(["/login"]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  const decoded = token ? decodeAccessToken(token) : null;
  const isAuthenticated = decoded !== null;

  if (PUBLIC_PATHS.has(pathname)) {
    if (isAuthenticated && decoded) {
      return NextResponse.redirect(new URL(homePathForRole(decoded.role), request.url));
    }
    return NextResponse.next();
  }

  if (!isAuthenticated || !decoded) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    const response = NextResponse.redirect(loginUrl);
    if (token) {
      response.cookies.delete(ACCESS_COOKIE);
      response.cookies.delete(REFRESH_COOKIE);
    }
    return response;
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL(homePathForRole(decoded.role), request.url));
  }

  if (!roleAllowedOnPath(decoded.role, pathname)) {
    return NextResponse.redirect(new URL(homePathForRole(decoded.role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
