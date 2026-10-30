import { RotateCcw } from "lucide-react";
import { steps } from "./LandingPageData";
import { SectionHeader } from "./SectionHeader";

export function HowItWorksSection() {
  return (
    <section className="lp-section is-band" id="how">
      <div className="lp-wrap">
        <SectionHeader
          label="how it works"
          title="From “I think I know it” to a clearer explanation."
          copy="Add your notes, slides, readings, or course materials. Choose a concept, explain it in your own words, find the step you skipped, then explain it again until it is clear."
        />
        <ol className="lp-steps">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            const isCoreStep = index === 3;

            return (
              <li className={`lp-step lp-reveal ${isCoreStep ? "is-core" : ""}`} key={step.title}>
                <div className="lp-step-top">
                  <span className="fd-icon-tile">
                    <StepIcon size={17} strokeWidth={1.8} />
                  </span>
                  <span className="fd-kicker">{String(index + 1).padStart(2, "0")}</span>
                </div>
                {isCoreStep ? <span className="fd-eyebrow is-amber">The Feynduck moment</span> : null}
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </li>
            );
          })}
        </ol>
        <div className="lp-loop lp-reveal">
          <span className="fd-pill">
            <RotateCcw size={13} strokeWidth={2} />
            Repeat until it clicks.
          </span>
        </div>
      </div>
    </section>
  );
}
