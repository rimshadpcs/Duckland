export default function Loading() {
  return (
    <div className="app-workspace dashboard-rooms">
      <main className="room-loading-shell" aria-live="polite">
        <div className="route-skeleton route-skeleton-wide" />
        <div className="room-loading-grid">
          <div className="route-skeleton route-skeleton-card" />
          <div className="route-skeleton route-skeleton-card" />
          <div className="route-skeleton route-skeleton-card" />
        </div>
      </main>
    </div>
  );
}
