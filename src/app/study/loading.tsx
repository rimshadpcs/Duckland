export default function Loading() {
  return (
    <div className="fd" aria-busy="true" aria-live="polite">
      <header className="fd-header">
        <div className="fd-header-inner">
          <span className="fd-skeleton" style={{ width: 120, height: 24 }} />
          <span className="fd-skeleton" style={{ width: 80, height: 32 }} />
        </div>
      </header>
      <main className="fd-page fd-pulse">
        <div className="fd-page-head">
          <div>
            <span className="fd-skeleton" style={{ width: 220, height: 32 }} />
            <span className="fd-skeleton" style={{ width: 360, height: 16 }} />
          </div>
        </div>
        <span className="fd-skeleton" style={{ height: 86, borderRadius: 12 }} />
        <div className="fd-loading-rooms">
          <span className="fd-skeleton" style={{ height: 150, borderRadius: 12 }} />
          <span className="fd-skeleton" style={{ height: 150, borderRadius: 12 }} />
          <span className="fd-skeleton" style={{ height: 150, borderRadius: 12 }} />
        </div>
      </main>
    </div>
  );
}
