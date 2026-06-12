"use client";

import { useState } from "react";
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
    explanation: "Feynduck compares your explanation with the source material, identifies the exact missing reasoning step, and asks one targeted question to help you discover it.",
  },
  {
    explanation: "Feynduck asks one targeted question about the missing link, then gives you another chance to explain it clearly.",
  },
  {
    explanation: "Your clarity score helps you see which concepts are ready and which still need another explanation loop.",
  },
  {
    explanation: "Feynduck turns the exact gaps in your explanation into focused quizzes and flashcards — so you practise what you actually need.",
  },
];

export function ProductPreview() {
  const [active, setActive] = useState(0);
  const activeState = previewStates[active];

  return (
    <section className="section product-preview" id="preview">
      <SectionHeader
        label="product preview"
        title="See how Feynduck works"
        copy="From notes to explanation to missing link — one study loop at a time."
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
                onClick={() => setActive(index)}
                title={item.title}
              />
            ))}
          </div>
        </div>

        <div className="demo-stage">
          <div className="preview-step-explainer">
            <span>What happens here</span>
            <p>{activeState.explanation}</p>
          </div>
          <DashboardPreview activeStep={active} />
        </div>
      </div>
    </section>
  );
}
