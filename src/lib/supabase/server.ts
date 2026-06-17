import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@src/types/database";
import { getSupabaseBrowserEnv } from "./env";

export async function createSupabaseServerClient() {
  const { url, publishableKey } = getSupabaseBrowserEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot set cookies. Middleware or Route Handlers
          // will refresh/write auth cookies when a response is mutable.
        }
      },
    },
  });
}
