import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@src/lib/supabase/server";

const confirmationOtpTypes: EmailOtpType[] = ["email", "signup"];

function getSafeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/onboarding";
  }

  return value;
}

function getConfirmationOtpType(value: string | null) {
  return confirmationOtpTypes.find((type) => type === value) ?? null;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const otpType = getConfirmationOtpType(requestUrl.searchParams.get("type"));
  const next = getSafeNext(requestUrl.searchParams.get("next"));

  let failed = true;

  // token_hash links verify without a PKCE code verifier, so they work in any
  // browser. `code` links (older emails) still need the browser that signed up.
  if (tokenHash && otpType) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ type: otpType, token_hash: tokenHash });
    failed = Boolean(error);
  } else if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    failed = Boolean(error);
  }

  if (failed) {
    const loginUrl = new URL("/login", requestUrl.origin);
    loginUrl.searchParams.set("next", next);
    loginUrl.searchParams.set("error", "confirmation_failed");
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
