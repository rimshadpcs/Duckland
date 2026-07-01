"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@src/lib/supabase/server";

export type AuthActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
};

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getSafeNext(value: string, fallback = "/study") {
  if (!value || value === "/" || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}

async function getRequestOrigin() {
  const headerStore = await headers();
  const envOrigin = process.env.NEXT_PUBLIC_SITE_URL;
  const headerOrigin = headerStore.get("origin");
  const host = headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") || "http";

  if (envOrigin && envOrigin !== "null") return envOrigin.replace(/\/$/, "");
  if (headerOrigin && headerOrigin !== "null") return headerOrigin.replace(/\/$/, "");
  return host ? `${protocol}://${host}` : "http://localhost:3000";
}

function mapAuthError(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes("invalid login credentials")) {
    return "Email or password is incorrect.";
  }

  if (lower.includes("already registered") || lower.includes("already exists")) {
    return "An account already exists for this email.";
  }

  return message || "Authentication failed. Please try again.";
}

export async function loginAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = getString(formData, "email").toLowerCase();
  const password = getString(formData, "password");
  const next = getSafeNext(getString(formData, "next"));
  const fieldErrors: Record<string, string> = {};

  if (!isValidEmail(email)) fieldErrors.email = "Enter a valid email address.";
  if (!password) fieldErrors.password = "Enter your password.";
  if (Object.keys(fieldErrors).length) {
    return { status: "error", fieldErrors };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { status: "error", message: mapAuthError(error.message) };
  }

  redirect(next);
}

export async function signupAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const displayName = getString(formData, "displayName");
  const email = getString(formData, "email").toLowerCase();
  const password = getString(formData, "password");
  const confirmPassword = getString(formData, "confirmPassword");
  const next = getSafeNext(getString(formData, "next"), "/onboarding");
  const fieldErrors: Record<string, string> = {};

  if (displayName.length < 2) fieldErrors.displayName = "Enter your display name.";
  if (!isValidEmail(email)) fieldErrors.email = "Enter a valid email address.";
  if (password.length < 8) fieldErrors.password = "Use at least 8 characters.";
  if (password !== confirmPassword) fieldErrors.confirmPassword = "Passwords must match.";
  if (Object.keys(fieldErrors).length) {
    return { status: "error", fieldErrors };
  }

  const origin = await getRequestOrigin();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
        full_name: displayName,
      },
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    return { status: "error", message: mapAuthError(error.message) };
  }

  if (!data.session) {
    return {
      status: "success",
      message: "Check your email to confirm your account.",
    };
  }

  redirect(next);
}
