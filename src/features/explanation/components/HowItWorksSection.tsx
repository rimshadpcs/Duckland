"use client";

import { RotateCcw } from "lucide-react";
import { useThemeMode } from "@src/lib/useThemeMode";
import { steps } from "./LandingPageData";
import { SectionHeader } from "./SectionHeader";

export function HowItWorksSection() {
  const { themeMode, mounted } = useThemeMode();
  const isDark = mounted && themeMode === "obsidian";

  return (
    <section className="lp-section sk-panel is-blue" id="how">
      <div className="lp-wrap">
        <SectionHeader
          label="how it works"
          title="From “I think I know it” to a clearer explanation."
        />
        <figure className="sk-banner lp-reveal">
          <img
            src={isDark ? "/wide_banner_dark.webp" : "/wide_banner.webp"}
            alt="Three panels: the Feynman Technique (explain it simply), rubber ducking (talk it through), and Feynduck (the duck talks back)"
            width={1672}
            height={941}
          />
        </figure>
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
                  <span className="fd-kicker">{index + 1}</span>
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
