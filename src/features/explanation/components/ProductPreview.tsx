"use client";

import { useEffect, useState } from "react";
import { DashboardPreview } from "./DashboardPreview";
import { previewItems } from "./LandingPageData";
import { PreviewNavItem } from "./PreviewNavItem";
import { SectionHeader } from "./SectionHeader";

const previewStates = [
  {
    explanation: "Add notes, slides, readings, text, or links. Feynduck uses your course materials for every explanation and follow-up question.",
  },
  {
    explanation: "Explain the concept in your own words by typing or speaking. Feynduck listens for how your thinking connects, not just the right keywords.",
  },
  {
    explanation: "Feynduck compares your explanation with your materials, shows the step you skipped, and asks a targeted follow-up question.",
  },
  {
    explanation: "The feedback leads into a second explanation, so you rebuild the answer instead of passively reading a correction.",
  },
  {
    explanation: "Your Clarity Score helps you see which concepts are ready and which still need another attempt.",
  },
  {
    explanation: "Feynduck turns the exact gaps in your explanation into focused quizzes and flashcards — so you practise what you actually need.",
  },
];

const cycleMs = 5200;

export function ProductPreview() {
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const activeState = previewStates[active];

  useEffect(() => {
    let frame = 0;
    const startedAt = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startedAt;
      const nextProgress = Math.min((elapsed / cycleMs) * 100, 100);
      setProgress(nextProgress);

      if (elapsed >= cycleMs) {
        setActive((current) => (current + 1) % previewItems.length);
      } else {
        frame = window.requestAnimationFrame(tick);
      }
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [active]);

  const selectPreview = (index: number) => {
    setActive(index);
    setProgress(0);
  };

  return (
    <section className="lp-section" id="preview">
      <div className="lp-wrap">
        <SectionHeader
          label="product preview"
          title="See how Feynduck tests your understanding."
          copy="Watch Feynduck move from your materials to the step you skipped, a clearer explanation, and a simple view of what you can explain."
        />
        <div className="lp-preview lp-reveal">
          <div className="lp-preview-steps" aria-label="Product preview steps">
            {previewItems.map((item, index) => (
              <PreviewNavItem
                active={active === index}
                description={item.description}
                icon={item.icon}
                key={item.title}
                onClick={() => selectPreview(index)}
                progress={active === index ? progress : 0}
                title={item.title}
              />
            ))}
          </div>

          <div className="lp-preview-stage">
            <div className="lp-preview-note">
              <span className="fd-kicker">{String(active + 1).padStart(2, "0")}</span>
              <p>{activeState.explanation}</p>
            </div>
            <DashboardPreview activeStep={active} />
          </div>
        </div>
      </div>
    </section>
  );
}
