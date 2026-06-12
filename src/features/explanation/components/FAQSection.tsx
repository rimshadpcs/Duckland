"use client";

import { useState } from "react";
import { faqs } from "./LandingPageData";
import { SectionHeader } from "./SectionHeader";

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className="section faq-section" id="faq">
      <SectionHeader
        label="faq"
        title="Questions students usually ask."
        copy="Feynduck is built around explaining, not passive rereading. Here's how it works."
      />
      <div className="faq-list reveal">
        {faqs.map((item, index) => {
          const isOpen = openIndex === index;
          const answerId = `faq-answer-${index}`;

          return (
            <article className={`faq-item ${isOpen ? "open" : ""}`} key={item.question}>
              <button
                aria-controls={answerId}
                aria-expanded={isOpen}
                onClick={() => setOpenIndex(isOpen ? -1 : index)}
                type="button"
              >
                <span>{item.question}</span>
                <i aria-hidden="true" />
              </button>
              <div className="faq-answer" id={answerId}>
                <p>{item.answer}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
