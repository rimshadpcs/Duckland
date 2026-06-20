"use client";

import { useEffect } from "react";

export function AuthRedirect({ to }: { to: string }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);

  return (
    <main className="auth-page">
      <div className="auth-shell">
        <a className="auth-brand" href="/">
          <img src="/feynduckhead.png" alt="" />
          <span>Feynduck</span>
        </a>
        <section className="auth-card auth-choice-card">
          <div className="auth-copy">
            <p>Redirecting</p>
            <h1>Taking you to the right place.</h1>
          </div>
          <a className="auth-submit" href={to}>
            Continue
          </a>
        </section>
      </div>
    </main>
  );
}
