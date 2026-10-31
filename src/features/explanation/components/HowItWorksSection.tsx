"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, FileText, Mic, RotateCcw } from "lucide-react";
import { useThemeMode } from "@src/lib/useThemeMode";
import { steps } from "./LandingPageData";
import { SectionHeader } from "./SectionHeader";

const CORE_STEP = 2;
const tones = ["is-yellow", "is-blue", "is-orange", "is-cream", "is-green"];

function NotesMock() {
  const files = ["Lecture 4: Circulation.pdf", "Week 3 slides.pptx", "Reading, chapter 7"];
  return (
    <div className="sk-mock">
      <span className="sk-mock-label">Cardio room</span>
      <ul className="sk-mock-files">
        {files.map((file) => (
          <li key={file}>
            <FileText size={15} strokeWidth={1.8} />
            {file}
            <Check className="sk-mock-tick" size={15} strokeWidth={2.4} />
          </li>
        ))}
      </ul>
      <span className="sk-mock-foot">3 files read</span>
    </div>
  );
}

function ExplainMock() {
  return (
    <div className="sk-mock">
      <span className="sk-mock-label">Your explanation</span>
      <p className="sk-mock-quote">
        “Blood picks up oxygen in the lungs, and then the heart pumps it out to your toes…”
      </p>
      <div className="sk-mock-rec">
        <Mic size={15} strokeWidth={2} />
        <span className="sk-mock-wave" aria-hidden="true">
          {Array.from({ length: 18 }, (_, i) => (
            <i key={i} style={{ height: `${30 + ((i * 37) % 70)}%` }} />
          ))}
        </span>
        0:42
      </div>
    </div>
  );
}

function GapMock() {
  return (
    <div className="sk-mock">
      <span className="sk-mock-label">Missing step</span>
      <ol className="sk-mock-chain">
        <li>Blood picks up oxygen in the lungs</li>
        <li className="is-gap">?</li>
        <li>The heart pumps it out to your toes</li>
      </ol>
      <span className="sk-mock-foot">Your notes say it goes back to the heart first.</span>
    </div>
  );
}

function QuestionMock() {
  return (
    <div className="sk-mock">
      <p className="sk-mock-bubble is-duck">How does the blood get from the lungs to your toes?</p>
      <p className="sk-mock-bubble is-you">
        Oh, it goes back to the left side of the heart first, then out through the aorta.
      </p>
    </div>
  );
}

function AgainMock() {
  return (
    <div className="sk-mock">
      <span className="sk-mock-label">Clarity Score</span>
      <div className="sk-mock-bars">
        <span>
          Before <b>54</b>
          <i style={{ width: "54%" }} />
        </span>
        <span className="is-after">
          After <b>81</b>
          <i style={{ width: "81%" }} />
        </span>
      </div>
      <div className="sk-mock-chips">
        <span>4 quiz questions</span>
        <span>6 flashcards</span>
      </div>
    </div>
  );
}

const mocks = [NotesMock, ExplainMock, GapMock, QuestionMock, AgainMock];

export function HowItWorksSection() {
  const { themeMode, mounted } = useThemeMode();
  const isDark = mounted && themeMode === "obsidian";
  const trackRef = useRef<HTMLOListElement>(null);
  const [active, setActive] = useState(0);

  // The tab follows whichever card is mostly in view, however the track was scrolled
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.index));
        }
      },
      { root: track, threshold: 0.6 },
    );
    track.querySelectorAll<HTMLElement>(".sk-slide").forEach((slide) => observer.observe(slide));
    return () => observer.disconnect();
  }, []);

  const goTo = (index: number) => {
    const track = trackRef.current;
    const slide = track?.querySelectorAll<HTMLElement>(".sk-slide")[index];
    if (!track || !slide) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollTo({ left: slide.offsetLeft - track.offsetLeft, behavior: reduceMotion ? "auto" : "smooth" });
  };

  return (
    <section className="lp-section sk-panel is-blue" id="how">
      <div className="lp-wrap">
        <SectionHeader
          label="how it works"
          title="From “I think I know it” to a clearer explanation."
          copy="What you do at each step, and what you get out of it."
        />
        <figure className="sk-banner lp-reveal">
          <img
            src={isDark ? "/wide_banner_dark.webp" : "/wide_banner.webp"}
            alt="Three panels: the Feynman Technique (explain it simply), rubber ducking (talk it through), and Feynduck (the duck talks back)"
            width={1672}
            height={941}
          />
        </figure>

        <div className="sk-carousel lp-reveal">
          <div className="sk-tabs" role="group" aria-label="Steps">
            {steps.map((step, index) => (
              <button
                type="button"
                className={`sk-tab ${active === index ? "is-active" : ""}`}
                aria-pressed={active === index}
                onClick={() => goTo(index)}
                key={step.tab}
              >
                <span>{index + 1}</span>
                {step.tab}
              </button>
            ))}
          </div>

          <ol className="sk-track" ref={trackRef}>
            {steps.map((step, index) => {
              const Mock = mocks[index];
              return (
                <li className={`sk-slide ${tones[index]}`} data-index={index} key={step.title}>
                  <div className="sk-slide-copy">
                    <span className="sk-slide-kicker">
                      {index === CORE_STEP ? "Step 3 · The Feynduck moment" : `Step ${index + 1}`}
                    </span>
                    <h3>{step.title}</h3>
                    <p>{step.copy}</p>
                    <p className="lp-step-gain">
                      <b>You get</b>
                      {step.gain}
                    </p>
                  </div>
                  <div className="sk-slide-art" aria-hidden="true">
                    <Mock />
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="sk-carousel-nav">
            <button
              type="button"
              aria-label="Previous step"
              disabled={active === 0}
              onClick={() => goTo(active - 1)}
            >
              <ArrowLeft size={18} strokeWidth={2} />
            </button>
            <button
              type="button"
              aria-label="Next step"
              disabled={active === steps.length - 1}
              onClick={() => goTo(active + 1)}
            >
              <ArrowRight size={18} strokeWidth={2} />
            </button>
          </div>
        </div>

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
