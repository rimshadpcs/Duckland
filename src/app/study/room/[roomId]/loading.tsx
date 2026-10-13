export default function Loading() {
  return (
    <div className="fd" aria-busy="true" aria-live="polite">
      <header className="fd-header">
        <div className="fd-header-inner">
          <span className="fd-skeleton" style={{ width: 260, height: 24 }} />
          <span className="fd-skeleton" style={{ width: 80, height: 32 }} />
        </div>
      </header>
      <main className="fd-page is-room fd-pulse">
        <div className="fd-page-head">
          <div>
            <span className="fd-skeleton" style={{ width: 280, height: 32 }} />
            <span className="fd-skeleton" style={{ width: 320, height: 14 }} />
          </div>
        </div>
        <span className="fd-skeleton" style={{ height: 96, borderRadius: 14 }} />
        <div className="fd-room-columns">
          <div className="fd-room-main">
            <span className="fd-skeleton" style={{ height: 220, borderRadius: 12 }} />
            <span className="fd-skeleton" style={{ height: 72, borderRadius: 12 }} />
          </div>
          <div className="fd-room-aside">
            <span className="fd-skeleton" style={{ height: 72, borderRadius: 12 }} />
          </div>
        </div>
      </main>
    </div>
  );
}
