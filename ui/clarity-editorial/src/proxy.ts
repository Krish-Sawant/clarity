import { NextResponse, type NextRequest } from "next/server";
import { auth0 } from "./lib/auth/server";

export async function proxy(request: NextRequest) {
  if (!auth0) {
    if (request.nextUrl.pathname === "/login") return NextResponse.next();
    if (request.nextUrl.pathname.startsWith("/api/") || request.nextUrl.pathname.startsWith("/auth/")) {
      return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }
  // The SDK owns callback validation, state, PKCE, cookies and logout.
  return auth0.middleware(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
