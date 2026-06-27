import { WaitlistForm } from "@src/features/explanation/components/WaitlistForm";
import { TrackEventOnMount } from "@src/features/explanation/components/TrackEventOnMount";

export default function DuckWatchPage() {
  return (
    <main className="duck-watch-page">
      <TrackEventOnMount eventName="duck_watch_viewed" />
      <section className="duck-watch">
        <div className="duck-watch-copy">
          <h1>The duck is keeping the study room warm.</h1>
          <p className="duck-watch-message">
            Feynduck is in private testing right now. If you have access, use the test link you were given.
          </p>
        </div>
        <div className="funny-duck-stage">
          <img
            src="/funny_duck.png"
            alt="Feynduck waiting with study notes"
            width={1200}
            height={1200}
            loading="eager"
          />
        </div>
        <div className="duck-watch-waitlist">
          <h2>Join the waitlist</h2>
          <p>The duck is taking names. Politely.</p>
          <WaitlistForm source="duck_watch" />
        </div>
        <a className="duck-watch-link" href="/">
          Back to Feynduck
        </a>
      </section>
    </main>
  );
}
