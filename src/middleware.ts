import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const hostname = request.headers.get("host");

  // Define the target subdomain
  const appDomain = "app.feynduck.com";

  // If the host is the app subdomain, rewrite to the /study experience
  if (hostname === appDomain) {
    url.pathname = `/study${url.pathname === "/" ? "" : url.pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

// Only run middleware on the root path and study path for efficiency
export const config = {
  matcher: ["/", "/study/:path*"],
};
