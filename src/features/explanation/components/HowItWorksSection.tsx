import { steps } from "./LandingPageData";
import { SectionHeader } from "./SectionHeader";

export function HowItWorksSection() {
  return (
    <section className="section how" id="how">
      <SectionHeader
        label="how it works"
        title="From “I think I know it” to a clearer explanation."
        copy="Add your notes, slides, readings, or course materials. Choose a concept, explain it in your own words, find the step you skipped, then explain it again until it is clear."
      />
      <div className="steps">
        {steps.map((step, index) => {
          const StepIcon = step.icon;
          const isCoreStep = index === 3;

          return (
            <div className={`step-item reveal ${isCoreStep ? "core-step" : ""}`} key={step.title}>
              <article className="step-card">
                <div className="step-card-top">
                  <span className="step-card-number">{String(index + 1).padStart(2, "0")}</span>
                  <span className="step-card-icon">
                    <StepIcon size={20} />
                  </span>
                </div>
                {isCoreStep ? <span className="step-card-kicker">The Feynduck moment</span> : null}
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </article>
            </div>
          );
        })}
      </div>
      <div className="loop-cue reveal">
        <span aria-hidden="true" />
        <p>Repeat until it clicks.</p>
      </div>
    </section>
  );
}
