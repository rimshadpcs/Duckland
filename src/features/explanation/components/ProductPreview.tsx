"use client";

import { useEffect, useState } from "react";
import { DashboardPreview } from "./DashboardPreview";
import { previewItems } from "./LandingPageData";
import { PreviewNavItem } from "./PreviewNavItem";
import { SectionHeader } from "./SectionHeader";

const previewStates = [
  {
    explanation: "Add PDFs, slides, notes, text, or links. Feynduck uses your source material as the context for every explanation and follow-up question.",
  },
  {
    explanation: "Explain the concept in your own words by typing or speaking. Feynduck listens for the reasoning behind your answer, not just the right keywords.",
  },
  {
    explanation: "Feynduck compares your explanation with the source, separates the missing link from the follow-up question, and shows exactly what to repair.",
  },
  {
    explanation: "The feedback naturally leads into a second explanation, so the student rebuilds the answer instead of passively reading a correction.",
  },
  {
    explanation: "Your clarity score helps you see which concepts are ready and which still need another explanation loop.",
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
    <section className="section product-preview" id="preview">
      <SectionHeader
        label="product preview"
        title="A time-lapsed workspace."
        copy="The preview cycles through the full loop: source material, explanation, missing link, re-explanation, score, and study tools."
      />
      <div className="preview-layout landing-preview-layout reveal">
        <div className="preview-sidebar">
          <div className="preview-tabs" aria-label="Product preview steps">
            {previewItems.map((item, index) => (
              <PreviewNavItem
                active={active === index}
                description={item.description}
                icon={item.icon}
                index={index}
                key={item.title}
                onClick={() => selectPreview(index)}
                progress={active === index ? progress : 0}
                title={item.title}
              />
            ))}
          </div>
        </div>

        <div className="demo-stage" data-active-step={active}>
          <div className="preview-step-explainer">
            <span>What happens here</span>
            <p>{activeState.explanation}</p>
          </div>
          <div className="cursor-simulation" aria-hidden="true">
            <span />
          </div>
          <DashboardPreview activeStep={active} />
        </div>
      </div>
    </section>
  );
}
