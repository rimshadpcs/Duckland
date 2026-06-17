import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSupabaseSession } from "@src/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get("host");
  const pathname = request.nextUrl.pathname;
  const needsAuthMiddleware =
    hostname === "app.feynduck.com" ||
    pathname === "/study" ||
    pathname.startsWith("/study/") ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/start" ||
    pathname === "/onboarding" ||
    pathname.startsWith("/auth/");

  if (!needsAuthMiddleware) {
    return NextResponse.next();
  }

  return updateSupabaseSession(request);
}

export const config = {
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
