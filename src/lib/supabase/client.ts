"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@src/types/database";
import { getSupabaseBrowserEnv } from "./env";

export function createSupabaseBrowserClient() {
  const { url, publishableKey } = getSupabaseBrowserEnv();

  return createBrowserClient<Database>(url, publishableKey);
}
