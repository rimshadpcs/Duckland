import Link from "next/link";

export const dynamic = "force-dynamic";

function getSafeNext(value?: string | string[]) {
  const next = Array.isArray(value) ? value[0] : value;
  if (!next || next === "/" || !next.startsWith("/") || next.startsWith("//")) {
    return "/study";
  }
  return next;
}

export default async function StartPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const next = getSafeNext(params?.next);

  return (
    <main className="auth-page">
      <div className="auth-shell">
        <a className="auth-back-link" href="/">
          ← Back
        </a>
        <a className="auth-brand" href="/">
          <img src="/feynduckhead.png" alt="" />
          <span>Feynduck</span>
        </a>
        <section className="auth-card auth-choice-card">
          <div className="auth-copy">
            <p>Start studying</p>
            <h1>How do you want to continue?</h1>
          </div>
          <div className="auth-choice-actions">
            <Link className="auth-submit" href={`/signup?next=${encodeURIComponent(next)}`}>
              Create an account
            </Link>
            <Link className="auth-secondary-link" href={`/login?next=${encodeURIComponent(next)}`}>
              I already have an account
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
