import { Brand } from "@src/components/app/AppHeader";
import { AuthForm } from "@src/features/auth/components/AuthForm";

export const dynamic = "force-dynamic";

function getSafeNext(value?: string | string[]) {
  const next = Array.isArray(value) ? value[0] : value;
  if (!next || next === "/" || !next.startsWith("/") || next.startsWith("//")) {
    return "/study";
  }
  return next;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string | string[]; error?: string | string[] }>;
}) {
  const params = await searchParams;
  const next = getSafeNext(params?.next);
  const errorParam = Array.isArray(params?.error) ? params?.error[0] : params?.error;
  const initialError = errorParam === "confirmation_failed"
    ? "We couldn't sign you in from that confirmation link. If you've already confirmed your email, log in with your email and password."
    : null;

  return (
    <div className="fd fd-auth">
      <header className="fd-auth-header">
        <Brand href="/" />
        <a className="fd-text-link" href={`/signup?next=${encodeURIComponent(next)}`}>Create account</a>
      </header>
      <main className="fd-auth-main">
        <AuthForm mode="login" next={next} initialError={initialError} />
      </main>
    </div>
  );
}
