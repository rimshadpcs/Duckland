import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabase/server";
import type { Database } from "@src/types/database";

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export type AuthenticatedUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  label: string;
  profile: ProfileRow | null;
};

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;

  try {
    supabase = await createSupabaseServerClient();
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[Supabase] auth skipped because client could not be created", error);
    }
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const email = profile?.email || user.email || null;
  const displayName = profile?.display_name || null;

  return {
    id: user.id,
    email,
    displayName,
    label: displayName || email || "Account",
    profile,
  };
}

export async function requireAuthenticatedUser(next = "/study") {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  return user;
}

export async function requireOnboardedUser(next = "/study") {
  const user = await requireAuthenticatedUser(next);

  if (!user.profile?.onboarding_completed) {
    redirect(`/onboarding?next=${encodeURIComponent(next)}`);
  }

  return user;
}
