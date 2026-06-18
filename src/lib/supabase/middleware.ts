import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@src/types/database";

const APP_DOMAIN = "app.feynduck.com";

function getSupabaseMiddlewareEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  return { url, publishableKey };
}

function getEffectivePathname(request: NextRequest) {
  const hostname = request.headers.get("host");
  const pathname = request.nextUrl.pathname;

  if (hostname === APP_DOMAIN) {
    if (pathname === "/") return "/study";
    if (pathname === "/session" || pathname.startsWith("/session/")) return `/study${pathname}`;
    if (pathname === "/study" || pathname.startsWith("/study/")) return pathname;
    return pathname;
  }

  return pathname;
}

function createRedirect(request: NextRequest, pathname: string, next?: string, cookiesFrom?: NextResponse) {
  const url = request.nextUrl.clone();
  url.pathname = request.headers.get("host") === APP_DOMAIN && pathname === "/study" ? "/" : pathname;
  url.search = "";
  if (next) {
    url.searchParams.set("next", next);
  }
  const redirectResponse = NextResponse.redirect(url);
  cookiesFrom?.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });
  return redirectResponse;
}

export async function updateSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = getSupabaseMiddlewareEnv();

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const effectivePathname = getEffectivePathname(request);
  const isProtectedRoute = effectivePathname === "/study" || effectivePathname.startsWith("/study/");
  const isAuthRoute = effectivePathname === "/login" || effectivePathname === "/signup";

  if (isProtectedRoute && !user) {
    const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    return createRedirect(request, "/login", next, response);
  }

  if (isAuthRoute && user) {
    return createRedirect(request, "/study", undefined, response);
  }

  const hostname = request.headers.get("host");
  if (hostname === APP_DOMAIN) {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = effectivePathname;
    const rewriteResponse = NextResponse.rewrite(rewriteUrl);
    response.cookies.getAll().forEach((cookie) => {
      rewriteResponse.cookies.set(cookie);
    });
    return rewriteResponse;
  }

  return response;
}
