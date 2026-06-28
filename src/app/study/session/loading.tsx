export default function Loading() {
  return (
    <div className="dashboard-container session-loading-shell" aria-live="polite">
      <aside className="dashboard-panel left-panel">
        <div className="route-skeleton route-skeleton-line" />
        <div className="route-skeleton route-skeleton-card compact" />
        <div className="route-skeleton route-skeleton-card compact" />
      </aside>
      <main className="dashboard-panel center-panel">
        <div className="conversation-area explain-workspace">
          <section className="explain-loop-surface">
            <div className="route-skeleton route-skeleton-hero" />
            <div className="route-skeleton route-skeleton-card" />
            <div className="route-skeleton route-skeleton-card compact" />
          </section>
        </div>
      </main>
      <aside className="dashboard-panel right-panel">
        <div className="route-skeleton route-skeleton-line" />
        <div className="route-skeleton route-skeleton-card compact" />
        <div className="route-skeleton route-skeleton-card compact" />
      </aside>
    </div>
  );
}
