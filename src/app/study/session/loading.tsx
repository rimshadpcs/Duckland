export default function Loading() {
  return (
    <div className="fd fd-session" aria-busy="true" aria-live="polite">
      <header className="fd-session-header">
        <span className="fd-skeleton" style={{ width: 240, height: 22 }} />
        <span className="fd-skeleton" style={{ width: 120, height: 32 }} />
      </header>
      <div className="fd-session-body fd-pulse">
        <aside className="fd-panel is-left" style={{ width: 320, padding: 16, gap: 12, animation: "none" }}>
          <span className="fd-skeleton" style={{ width: "60%", height: 18 }} />
          <span className="fd-skeleton" style={{ height: 140, borderRadius: 10 }} />
          <span className="fd-skeleton" style={{ width: "80%", height: 12 }} />
          <span className="fd-skeleton" style={{ width: "64%", height: 12 }} />
          <span className="fd-skeleton" style={{ width: "72%", height: 12 }} />
        </aside>
        <main className="fd-center">
          <div className="fd-center-inner">
            <span className="fd-skeleton" style={{ width: "45%", height: 28 }} />
            <span className="fd-skeleton" style={{ height: 240, borderRadius: 14 }} />
            <span className="fd-skeleton" style={{ height: 160, borderRadius: 14 }} />
          </div>
        </main>
        <aside className="fd-panel is-right" style={{ width: 360, padding: 12, gap: 16, animation: "none" }}>
          <span className="fd-skeleton" style={{ height: 40, borderRadius: 10 }} />
          <span className="fd-skeleton" style={{ height: 120, borderRadius: 10 }} />
        </aside>
      </div>
    </div>
  );
}
