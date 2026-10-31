import { Brain, Check, MessageCircleQuestion, Network } from "lucide-react";
import { SectionHeader } from "./SectionHeader";

const generalAi = [
  "Answers your question",
  "Creates polished summaries from your notes",
  "Makes it easy to recognise an answer",
  "Optimises for an immediately helpful response",
];

const feynduck = [
  "Questions your explanation",
  "Finds the step you skipped",
  "Makes you explain it again until it is clear",
  "Tracks whether your understanding improves",
];

const masteryPreview = [
  { label: "Cardiac output", status: "clear" },
  { label: "Stroke volume", status: "improving" },
  { label: "Preload", status: "gap_found" },
  { label: "Afterload", status: "not_started" },
];

export function AiComparisonSection() {
  return (
    <section className="lp-section">
      <div className="lp-wrap">
        <SectionHeader
          title="ChatGPT and NotebookLM can explain a subject to you."
          copy="Feynduck checks whether you can explain it yourself."
        />

        <div className="lp-grid-2 lp-reveal">
          <article className="lp-card">
            <span className="lp-card-label">
              <MessageCircleQuestion size={16} strokeWidth={1.8} /> ChatGPT &amp; NotebookLM
            </span>
            <h3>AI does more of the explaining.</h3>
            <ul className="lp-list is-muted">
              {generalAi.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </article>
          <article className="lp-card is-strong">
            <span className="lp-card-label">
              <img src="/feynduckhead.png" alt="" width={22} height={22} /> Feynduck
            </span>
            <h3>You do the explaining.</h3>
            <ul className="lp-list">
              {feynduck.map((item) => (
                <li key={item}><Check size={16} strokeWidth={2} />{item}</li>
              ))}
            </ul>
          </article>
        </div>

        <div className="lp-value lp-reveal">
          <div>
            <span className="fd-eyebrow">Long-term value</span>
            <h3>Build a record of what you can actually explain.</h3>
            <p>One study session finds a gap. Repeated sessions show what you understand, what still needs work, and whether your next attempt is better.</p>
          </div>
          <article className="lp-card">
            <span className="fd-icon-tile"><Brain size={18} strokeWidth={1.8} /></span>
            <h3>Clarity Score</h3>
            <p>A simple measure of how clearly you explained the concept.</p>
            <div className="fd-score" aria-hidden="true">
              <div className="fd-bar is-amber"><span style={{ width: "84%" }} /></div>
              <span className="fd-score-num">84<small>/100</small></span>
            </div>
          </article>
          <article className="lp-card">
            <span className="fd-icon-tile"><Network size={18} strokeWidth={1.8} /></span>
            <h3>Mastery Map</h3>
            <p>See what you can explain, what still needs work, and which earlier ideas may be holding you back.</p>
            <div className="lp-map" aria-hidden="true">
              {masteryPreview.map((concept) => (
                <span className="fd-pill" key={concept.label}>
                  <span className="fd-dot is-sm" data-status={concept.status} />
                  {concept.label}
                </span>
              ))}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
