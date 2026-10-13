import { Brand } from "@src/components/app/AppHeader";
import { AuthForm } from "@src/features/auth/components/AuthForm";

export const dynamic = "force-dynamic";

function getSafeNext(value?: string | string[]) {
  const next = Array.isArray(value) ? value[0] : value;
  if (!next || next === "/" || !next.startsWith("/") || next.startsWith("//")) {
    return "/onboarding";
  }
  return next;
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const next = getSafeNext(params?.next);

  return (
    <div className="fd fd-auth">
      <header className="fd-auth-header">
        <Brand href="/" />
        <a className="fd-text-link" href={`/login?next=${encodeURIComponent(next)}`}>Log in</a>
      </header>
      <main className="fd-auth-main" style={{ paddingBottom: 80 }}>
        <AuthForm mode="signup" next={next} />
      </main>
    </div>
  );
}
