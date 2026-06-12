import { SectionHeader } from "./SectionHeader";

export function QualityProofSection() {
  return (
    <section className="quality-proof section">
      <SectionHeader
        label="the problem"
        title="Recognising the idea is not the same as explaining the mechanism."
      />
      <div className="proof-grid reveal">
        <article className="proof-card before">
          <span>Before</span>
          <p>
            “Cardiac output is how much blood the heart pumps. If stroke volume goes down,
            the heart beats faster to make up for it.”
          </p>
          <small>Sounds right. But the formula link is missing.</small>
        </article>
        <article className="proof-card after">
          <span>After using Feynduck</span>
          <p>
            “Cardiac output equals heart rate multiplied by stroke volume. If stroke volume falls,
            heart rate has to increase to help keep the product stable, so the body compensates by
            pumping more often per minute.”
          </p>
          <small>Same student. Now the mechanism is visible.</small>
        </article>
      </div>
    </section>
  );
}
