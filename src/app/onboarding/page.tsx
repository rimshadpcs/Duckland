import { AuthRedirect } from "@src/features/auth/components/AuthRedirect";
import { OnboardingFlow } from "@src/features/auth/components/OnboardingFlow";
import { getAuthenticatedUser } from "@src/lib/auth";

export const dynamic = "force-dynamic";

function getSafeNext(value?: string | string[]) {
  const next = Array.isArray(value) ? value[0] : value;
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/study";
  }
  return next;
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const next = getSafeNext(params?.next);
  const user = await getAuthenticatedUser();

  if (!user) {
    return <AuthRedirect to={`/login?next=${encodeURIComponent(`/onboarding?next=${encodeURIComponent(next)}`)}`} />;
  }

  if (user.profile?.onboarding_completed) {
    return <AuthRedirect to="/study" />;
  }

  return <OnboardingFlow profile={user.profile} email={user.email} />;
}
