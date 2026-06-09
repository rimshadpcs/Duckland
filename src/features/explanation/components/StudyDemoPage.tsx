import { ExplainForm } from "./ExplainForm";

export function StudyDemoPage() {
  return (
    <main className="study-demo-page">
      <section className="study-demo-hero">
        <a className="study-demo-back" href="/">
          Back to Feynduck
        </a>
        <h1>Find the gap in your explanation.</h1>
        <p>
          Paste your notes, explain the concept in your own words, and let Feynduck show
          where the reasoning breaks.
        </p>
      </section>

      <ExplainForm />
    </main>
  );
}
