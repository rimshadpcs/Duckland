import { SectionHeader } from "./SectionHeader";

export function QualityProofSection() {
  return (
    <section className="quality-proof section">
      <SectionHeader
        label="see what Feynduck catches"
        title="The missing step becomes visible—and fixable."
      />
      <div className="diff-board reveal">
        <div className="diff-toolbar">
          <span>Student explanation diff</span>
          <small>Hover the improved version</small>
        </div>
        <div className="proof-grid">
          <article className="proof-card before">
            <span>Before</span>
            <p>
              Cardiac output is how much blood the heart pumps. If stroke volume goes down,
              the heart beats faster to make up for it.
            </p>
            <small>Sounds right. But the formula link is missing.</small>
          </article>
          <article className="proof-card after">
            <span>After Feynduck</span>
            <p>
              Cardiac output equals heart rate{" "}
              <mark>multiplied by stroke volume</mark>. If stroke volume falls, heart rate has to
              increase to help keep the product stable, so the body compensates by pumping more
              often per minute.
            </p>
            <div className="diff-callout">
              <strong>Causal link restored</strong>
              <small>The explanation now connects the compensation to the formula. Clarity Score: 58 → 84.</small>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
