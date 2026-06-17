export default function DuckWatchPage() {
  return (
    <main className="duck-watch-page">
      <section className="duck-watch">
        <div className="duck-watch-copy">
          <h1>The duck is keeping the study room warm.</h1>
          <p className="duck-watch-message">
            Feynduck is in private testing right now. If you have access, use the test link you were given.
          </p>
        </div>
        <div className="funny-duck-stage">
          <img src="/funny_duck.png" alt="Feynduck waiting with study notes" />
        </div>
        <a className="duck-watch-link" href="/">
          Back to Feynduck
        </a>
      </section>
    </main>
  );
}
