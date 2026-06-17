import { Duck } from "./Duck";

export function FinalCTASection({ studyHref = "/start" }: { studyHref?: string }) {
  return (
    <section className="final-cta reveal">
      <Duck />
      <h2>Stop guessing whether you understand.</h2>
      <p>Explain it to Feynduck and find out before the exam does.</p>
      <a className="button primary" href={studyHref}>
        Study with Feynduck →
      </a>
    </section>
  );
}
