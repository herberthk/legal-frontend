import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { UAParser } from "ua-parser-js";

export const proxy = async (request: NextRequest) => {
  // const user = await getCurrentUser();
  const { pathname } = request.nextUrl;

  const session = request.cookies.get("session")?.value;
  // Parse device info from request UA
  const ua = request.headers.get("user-agent") ?? "";
  const parser = new UAParser(ua);
  const result = parser.getResult();

  // 1. If trying to access dashboard without a session
  if (pathname.startsWith("/dashboard") && !session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("returnTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 2. If trying to access login/signup WITH a session
  // if (
  //   (pathname === "/login" || pathname === "/signup" || pathname === "/") &&
  //   user
  // ) {
  //   try {
  //     const dashboardPath =
  //       user.role === "ADMIN" ? "/dashboard/admin" : "/dashboard/user";
  //     return NextResponse.redirect(new URL(dashboardPath, request.url));
  //   } catch {
  //     return NextResponse.redirect(new URL("/dashboard", request.url));
  //   }
  // }

  // Forward device info as request headers to pages/routes
  const response = NextResponse.next();
  response.headers.set("x-device-browser", result.browser.name ?? "Unknown");
  response.headers.set(
    "x-device-browser-version",
    result.browser.version ?? "Unknown",
  );
  response.headers.set("x-device-os", result.os.name ?? "Unknown");
  response.headers.set("x-device-os-version", result.os.version ?? "Unknown");
  response.headers.set("x-device-type", result.device.type ?? "desktop");
  response.headers.set("x-device-model", result.device.model ?? "Unknown");
  response.headers.set("x-device-vendor", result.device.vendor ?? "Unknown");
  response.headers.set("x-device-ua", ua);

  return response;
};

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/signup", "/"],
};
