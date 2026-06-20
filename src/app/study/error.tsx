"use client";

export default function StudyError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="app-workspace dashboard-rooms">
      <section className="rooms-main" style={{ minHeight: "100vh", justifyContent: "center" }}>
        <div className="room-card empty-room-card" style={{ maxWidth: 520, margin: "0 auto" }}>
          <div className="card-top">
            <span className="room-subject">Something went wrong</span>
            <h3>Feynduck could not load this view.</h3>
            <p>
              {error?.message || "Refresh the page, or go back to your study rooms and try again."}
            </p>
          </div>
          <div className="modal-actions" style={{ justifyContent: "flex-start", marginTop: 24 }}>
            <button className="modal-btn-create" type="button" onClick={reset}>
              Try again
            </button>
            <a className="modal-btn-cancel" href="/study" style={{ textDecoration: "none" }}>
              Back to rooms
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
