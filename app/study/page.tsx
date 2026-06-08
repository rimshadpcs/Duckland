export default function StudyPage() {
  return (
    <main className="duck-watch-page">
      <section className="duck-watch">
        <div className="duck-watch-copy">
          <h1>Sorry, we haven&apos;t launched yet.</h1>
          <p className="duck-watch-message">
            It&apos;s under building, but meanwhile you can watch this duck.
          </p>
        </div>

        <div className="funny-duck-stage">
          <img src="/funny_duck.png" alt="A funny duck to watch while Feynduck is under building" />
        </div>

        <a className="duck-watch-link" href="/">
          Back to Feynduck
        </a>
      </section>
    </main>
  );
}
