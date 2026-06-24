import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@src/types/database";
import { getSupabaseBrowserEnv } from "./env";

const APP_DOMAIN = "app.feynduck.com";

function getSupabaseMiddlewareEnv() {
  return getSupabaseBrowserEnv();
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
  const effectivePathname = getEffectivePathname(request);
  const isProtectedRoute = effectivePathname === "/study" || effectivePathname.startsWith("/study/");
  const isAuthRoute = effectivePathname === "/login" || effectivePathname === "/signup";
  let env: ReturnType<typeof getSupabaseMiddlewareEnv>;

  try {
    env = getSupabaseMiddlewareEnv();
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[Supabase] middleware skipped because env is missing", error);
    }

    if (isProtectedRoute) {
      return createRedirect(request, "/login", `${request.nextUrl.pathname}${request.nextUrl.search}`, response);
    }

    return response;
  }

  const { url, publishableKey } = env;

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

  let user = null;

  try {
    const {
      data: { user: authenticatedUser },
    } = await supabase.auth.getUser();
    user = authenticatedUser;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[Supabase] middleware auth lookup failed", error);
    }

    if (isProtectedRoute) {
      const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
      return createRedirect(request, "/login", next, response);
    }

    return response;
  }

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
