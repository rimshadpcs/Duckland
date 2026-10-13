import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { AIServiceError } from "@src/lib/ai/claude";
import { createSupabaseServerClient } from "@src/lib/supabase/server";

// Rate-limit bindings declared in wrangler.jsonc.
type RateLimitBinding = "AI_USER_LIMITER" | "AI_DEMO_LIMITER";
type RateLimiter = { limit(options: { key: string }): Promise<{ success: boolean }> };

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function getApiUserId() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

async function isRateLimited(binding: RateLimitBinding, key: string) {
  let limiter: RateLimiter | undefined;
  try {
    limiter = (getCloudflareContext().env as unknown as Record<string, RateLimiter | undefined>)[binding];
  } catch {
    // Outside the Cloudflare runtime (e.g. plain `next start`) there is no limiter to ask.
    return false;
  }
  if (!limiter) return false;

  try {
    const { success } = await limiter.limit({ key });
    return !success;
  } catch (error) {
    console.warn(`[RateLimit] ${binding} check failed`, error);
    return false;
  }
}

/**
 * Middleware skips /api, so every AI route that costs money calls this first.
 * Returns a response to send back when the request must stop, otherwise null.
 */
export async function guardUserAIRequest() {
  const userId = await getApiUserId();
  if (!userId) return jsonError("Your session has ended. Sign in again to continue.", 401);

  if (await isRateLimited("AI_USER_LIMITER", `user:${userId}`)) {
    return jsonError("You're going a little fast. Wait a moment and try again.", 429);
  }

  return null;
}

/** The landing-page demo is public, so it is limited per IP address instead. */
export async function guardDemoAIRequest(request: Request) {
  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";

  if (await isRateLimited("AI_DEMO_LIMITER", `ip:${ip}`)) {
    return jsonError("The demo is busy. Wait a minute and try again.", 429);
  }

  return null;
}

export function aiErrorResponse(error: unknown, fallbackMessage: string) {
  if (error instanceof AIServiceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }

  console.error("[AI] unexpected error", error);
  return jsonError(fallbackMessage, 502);
}
