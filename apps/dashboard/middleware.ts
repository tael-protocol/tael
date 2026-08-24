import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken } from "@tael/auth";
import { AUTH_SECRET, SESSION_COOKIE } from "./lib/config";

/**
 * Auth gate. Verifies the Sign-In-With-Stellar session JWT. This runs on the
 * edge runtime, so it uses only @tael/auth (jose) — never the Stellar SDK.
 */
async function isAuthenticated(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  try {
    await verifySessionToken(token, AUTH_SECRET);
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const authed = await isAuthenticated(request);
  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/signup");
  const isPublicConnect = pathname.startsWith("/connect");

  if (!authed && !isAuthRoute && !isPublicConnect) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (authed && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next internals, static assets, the public embed script,
  // and the auth/API routes (which must be reachable while signed out).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|embed\\.js|api).*)"],
};
