"use client";

import { useEffect } from "react";

export function AuthRedirect({ to }: { to: string }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);

  return (
    <main className="fd" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="fd-center-inner is-narrow" aria-live="polite">
        <img src="/feynduckhead.png" alt="" width={44} height={44} />
        <div className="fd-busy">
          <span className="fd-spinner" aria-hidden="true" />
          Taking you to the right place…
        </div>
        <a className="fd-text-link" href={to}>Continue</a>
      </div>
    </main>
  );
}
