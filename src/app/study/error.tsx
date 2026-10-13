"use client";

import { AlertCircle } from "lucide-react";

export default function StudyError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="fd" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="fd-center-inner is-narrow fd-enter">
        <div className="fd-empty-tile" aria-hidden="true">
          <AlertCircle size={24} strokeWidth={1.8} />
        </div>
        <div className="fd-center-head">
          <h1 style={{ fontSize: 22 }}>Feynduck couldn’t load this view</h1>
          <p>{error?.message || "Refresh the page, or go back to your study rooms and try again."}</p>
        </div>
        <div className="fd-page-actions">
          <button type="button" className="fd-btn fd-btn-accent" onClick={reset}>
            Try again
          </button>
          <a href="/study" className="fd-btn fd-btn-ghost">
            Back to study rooms
          </a>
        </div>
      </div>
    </main>
  );
}
