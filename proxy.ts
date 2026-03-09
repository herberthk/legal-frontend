import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "./lib";

export const proxy = async (request: NextRequest) => {
  // const session = request.cookies.get("session")?.value;
  const user = await getCurrentUser();
  const { pathname } = request.nextUrl;

  // 1. If trying to access dashboard without a session
  if (pathname.startsWith("/dashboard") && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("returnTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 2. If trying to access login/signup WITH a session, redirect to dashboard
  if (
    (pathname === "/login" || pathname === "/signup" || pathname === "/") &&
    user
  ) {
    // Try to parse basic role info from session if possible, else default to /dashboard
    try {
      // const user = JSON.parse(decodeURIComponent(session));
      // console.log("user", user);
      const dashboardPath =
        user.role === "ADMIN" ? "/dashboard/admin" : "/dashboard/user";
      return NextResponse.redirect(new URL(dashboardPath, request.url));
    } catch {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return NextResponse.next();
};

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/signup", "/"],
};
