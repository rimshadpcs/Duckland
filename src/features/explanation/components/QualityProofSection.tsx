import { SectionHeader } from "./SectionHeader";

export function QualityProofSection() {
  return (
    <section className="lp-section sk-panel is-orange">
      <div className="lp-wrap">
        <SectionHeader
          title="The missing step in your explanation becomes visible."
        />
        <div className="lp-diff lp-reveal">
          <div className="fd-feedback-head">
            <div>
              <h2>Student explanation diff</h2>
            </div>
            <span className="fd-kicker">Cardiac output</span>
          </div>
          <div className="lp-diff-grid">
            <article>
              <span className="fd-pill is-danger">Before</span>
              <p>
                Cardiac output is how much blood the heart pumps. If stroke volume goes down,
                the heart beats faster to make up for it.
              </p>
              <small>Sounds right. But the formula link is missing.</small>
            </article>
            <article>
              <span className="fd-pill is-success">After Feynduck</span>
              <p>
                Cardiac output equals heart rate{" "}
                <mark>multiplied by stroke volume</mark>. If stroke volume falls, heart rate has to
                increase to help keep the product stable, so the body compensates by pumping more
                often per minute.
              </p>
              <div className="lp-diff-note">
                <div>
                  <strong>How the ideas connect</strong>
                  <span>The explanation now connects the compensation to the formula.</span>
                </div>
                <span className="lp-diff-score" aria-label="Clarity Score improved from 58 to 84">
                  <s>58</s> → 84
                </span>
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}
