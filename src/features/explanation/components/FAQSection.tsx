"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { faqs } from "./LandingPageData";
import { SectionHeader } from "./SectionHeader";

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className="lp-section" id="faq">
      <div className="lp-wrap">
        <SectionHeader
          label="faq"
          title="Questions students usually ask."
          copy="Feynduck is built around explaining, not passive rereading. Here's how it works."
        />
        <div className="lp-faq lp-reveal">
          {faqs.map((item, index) => {
            const isOpen = openIndex === index;
            const answerId = `faq-answer-${index}`;

            return (
              <article className={isOpen ? "is-open" : ""} key={item.question}>
                <button
                  aria-controls={answerId}
                  aria-expanded={isOpen}
                  onClick={() => setOpenIndex(isOpen ? -1 : index)}
                  type="button"
                >
                  <span>{item.question}</span>
                  <ChevronDown size={18} strokeWidth={1.8} aria-hidden="true" />
                </button>
                <div className="lp-faq-answer" id={answerId}>
                  <div>
                    <p>{item.answer}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
