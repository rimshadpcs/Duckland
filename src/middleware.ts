import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const APP_DOMAIN = "app.feynduck.com";

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get("host");
  const pathname = request.nextUrl.pathname;

  if (hostname !== APP_DOMAIN) {
    return NextResponse.next();
  }

  if (pathname === "/") {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = "/study";
    return NextResponse.rewrite(rewriteUrl);
  }

  if (pathname === "/session" || pathname.startsWith("/session/")) {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = `/study${pathname}`;
    return NextResponse.rewrite(rewriteUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
