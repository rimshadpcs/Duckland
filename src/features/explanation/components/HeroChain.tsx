"use client";

import { useEffect, useState } from "react";
import { DuckMascot, type DuckMood } from "./DuckMascot";
import { HandArrowDown, HandCircle } from "./HandMarks";

type Phase = "gap" | "asking" | "fixed";

// The hero picture: a student's explanation as a chain of steps with one missing.
// The duck asks about the gap, the student fills it in, and the score goes up. Loops.
const timeline: { phase: Phase; ms: number }[] = [
  { phase: "gap", ms: 1600 },
  { phase: "asking", ms: 3600 },
  { phase: "fixed", ms: 3800 },
];

const moodByPhase: Record<Phase, DuckMood> = { gap: "listening", asking: "asking", fixed: "idle" };

// What the student should take away from each stage of the loop.
const captions: { phase: Phase; text: string }[] = [
  { phase: "gap", text: "You explain a topic out loud" },
  { phase: "asking", text: "The duck spots the step you skipped and asks about it" },
  { phase: "fixed", text: "You fill the gap yourself, and your score goes up" },
];

export function HeroChain() {
  const [step, setStep] = useState(0);
  const phase = timeline[step].phase;

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStep(1);
      return;
    }
    const timer = window.setTimeout(() => setStep((current) => (current + 1) % timeline.length), timeline[step].ms);
    return () => window.clearTimeout(timer);
  }, [step]);

  return (
    <figure
      className={`sk-chain-figure is-${phase}`}
      aria-label="A student's explanation as three steps with the middle one missing. Feynduck asks about the missing step, and once it is filled in the Clarity Score rises from 54 to 81."
    >
      <div className="sk-chain-stage">
        <span className="sk-chain-label" aria-hidden="true">
          Your explanation
        </span>

        <ol className="sk-chain" aria-hidden="true">
          <li className="sk-step">Blood picks up oxygen in the lungs</li>
          <li className="sk-chain-link">
            <HandArrowDown />
          </li>
          <li className="sk-step is-gap">
            <HandCircle />
            <span className="sk-step-q">?</span>
            <span className="sk-step-fix">It goes back to the heart first</span>
          </li>
          <li className="sk-chain-link">
            <HandArrowDown />
          </li>
          <li className="sk-step">The heart pumps it out to your toes</li>
        </ol>

        <p className="sk-chain-bubble" aria-hidden="true">
          How does the blood get from the lungs to your toes?
        </p>

        <div className="sk-chain-duck" aria-hidden="true">
          <DuckMascot mood={moodByPhase[phase]} size={128} variant="full" />
        </div>

        <span className="sk-chain-score" aria-hidden="true">
          Clarity <b>{phase === "fixed" ? 81 : 54}</b>
        </span>
      </div>

      <ol className="sk-chain-steps">
        {captions.map((caption, index) => (
          <li key={caption.phase} className={caption.phase === phase ? "is-active" : ""}>
            <span>{index + 1}</span>
            {caption.text}
          </li>
        ))}
      </ol>
    </figure>
  );
}
