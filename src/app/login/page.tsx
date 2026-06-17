import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@src/features/auth/components/AuthForm";
import { getAuthenticatedUser } from "@src/lib/auth";

function getSafeNext(value?: string | string[]) {
  const next = Array.isArray(value) ? value[0] : value;
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/study";
  }
  return next;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const next = getSafeNext(params?.next);
  const user = await getAuthenticatedUser();

  if (user) {
    redirect(user.profile?.onboarding_completed ? "/study" : "/onboarding");
  }

  return (
    <main className="auth-page">
      <div className="auth-shell">
        <a className="auth-back-link" href="/start">
          ← Back
        </a>
        <a className="auth-brand" href="/">
          <img src="/feynduckhead.png" alt="" />
          <span>Feynduck</span>
        </a>
        <section className="auth-card">
          <div className="auth-copy">
            <p>Welcome back</p>
            <h1>Log in to keep studying.</h1>
          </div>
          <AuthForm mode="login" next={next} />
          <p className="auth-switch">
            New to Feynduck? <Link href={`/signup?next=${encodeURIComponent(next)}`}>Create an account</Link>
          </p>
        </section>
      </div>
    </main>
  );
}
