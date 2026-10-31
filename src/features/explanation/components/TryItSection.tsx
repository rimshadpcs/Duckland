"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Lightbulb, Play, RotateCcw } from "lucide-react";
import { trackEvent } from "@src/lib/analytics";
import { DuckMascot, type DuckMood } from "./DuckMascot";
import { HandCircle } from "./HandMarks";

type Phase = "ready" | "speaking" | "checking" | "result";

// A built-in example, so the page makes no AI calls: a typical first answer, spoken,
// and the feedback Feynduck gave it.
const question = "Explain why the Krebs cycle needs oxygen, even though oxygen is not directly used in the cycle.";
const answer =
  "Oxygen matters because cells need it for respiration. Without oxygen the cell switches to anaerobic respiration, so the Krebs cycle stops.";
const answerWords = answer.split(" ");
const feedback = {
  score: 58,
  label: "Getting there",
  gap: "Oxygen is the final electron acceptor in the electron transport chain. Without it, NADH can't unload its electrons, so NAD+ isn't regenerated, and the Krebs cycle can't keep running.",
  question: "What does the Krebs cycle need from NAD+, and what happens to NADH when oxygen is unavailable?",
};

// The mascot reacts to the example as it plays.
const moodByPhase: Record<Phase, DuckMood> = {
  ready: "idle",
  speaking: "listening",
  checking: "thinking",
  result: "asking",
};

const WORD_MS = 140;
const CHECK_MS = 1400;

export function TryItSection() {
  const [phase, setPhase] = useState<Phase>("ready");
  const [wordCount, setWordCount] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<number[]>([]);
  const hasAutoPlayedRef = useRef(false);

  const clearTimers = () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  };

  const play = () => {
    clearTimers();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setWordCount(answerWords.length);
      setPhase("result");
      return;
    }

    setWordCount(0);
    setPhase("speaking");
    answerWords.forEach((_, index) => {
      timersRef.current.push(window.setTimeout(() => setWordCount(index + 1), (index + 1) * WORD_MS));
    });
    const spokenMs = answerWords.length * WORD_MS + 400;
    timersRef.current.push(window.setTimeout(() => setPhase("checking"), spokenMs));
    timersRef.current.push(window.setTimeout(() => setPhase("result"), spokenMs + CHECK_MS));
  };

  // Play once when the example first scrolls into view.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAutoPlayedRef.current) {
          hasAutoPlayedRef.current = true;
          play();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(stage);
    return () => {
      observer.disconnect();
      clearTimers();
    };
  }, []);

  const replay = () => {
    trackEvent("hero_sandbox_checked", { mode: "example" });
    play();
  };

  const isSpeaking = phase === "speaking";
  const showAnswer = phase !== "ready";

  return (
    <section className="sk-try" id="try">
      <div className="lp-wrap">
        <div className="sk-try-head lp-reveal">
          <h2>Explain it out loud. The duck finds the gap.</h2>
          <p>Here&apos;s a typical first answer to a real exam question, and what Feynduck sends back.</p>
        </div>

        <div className="sk-try-stage lp-reveal" ref={stageRef}>
          <div className="sk-try-mascot">
            <DuckMascot mood={moodByPhase[phase]} size={140} variant="full" />
          </div>

          <div className="lp-sandbox sk-demo">
            <div className="lp-sandbox-head">
              <div>
                <img src="/feynduckhead.png" alt="" width={22} height={22} />
                Example
              </div>
              <span className="fd-kicker">Biology · Krebs cycle</span>
            </div>

            <div className="lp-sandbox-body">
              <div className="fd-ask">
                <Lightbulb size={16} strokeWidth={1.8} />
                <div>
                  <span>Explain this</span>
                  <span>{question}</span>
                </div>
              </div>

              {phase === "ready" ? (
                <div className="sk-demo-start">
                  <button className="sk-mic" type="button" onClick={replay}>
                    <Play size={22} strokeWidth={2} fill="currentColor" />
                    <span>Play the example</span>
                  </button>
                </div>
              ) : null}

              {showAnswer ? (
                <div className="fd-composer sk-demo-answer">
                  <span className="fd-composer-label">
                    {isSpeaking ? (
                      <span className="fd-rec">
                        <span />
                        Speaking
                      </span>
                    ) : (
                      "Student's explanation"
                    )}
                  </span>
                  <p aria-live="polite">
                    {answerWords.slice(0, wordCount).join(" ")}
                    {isSpeaking ? <span className="sk-caret" aria-hidden="true" /> : null}
                  </p>
                  {isSpeaking ? (
                    <span className="sk-wave is-auto" aria-hidden="true">
                      {Array.from({ length: 34 }, (_, index) => (
                        <span key={index} style={{ animationDelay: `${(index % 9) * 0.09}s` }} />
                      ))}
                    </span>
                  ) : null}
                </div>
              ) : null}

              {phase === "checking" ? (
                <p className="sk-demo-checking" aria-live="polite">
                  The duck is looking for the step you skipped…
                </p>
              ) : null}

              {phase === "result" ? (
                <div className="lp-sandbox-result is-visible" aria-live="polite">
                  <div className="sk-score">
                    <strong>{feedback.score}</strong>
                    <span>/100 · {feedback.label}</span>
                  </div>
                  <div className="lp-result-row is-gap">
                    <HandCircle />
                    <AlertTriangle size={16} strokeWidth={1.8} />
                    <div>
                      <strong>The step you skipped</strong>
                      <p>{feedback.gap}</p>
                    </div>
                    <span className="sk-note is-gap" aria-hidden="true">← the gap</span>
                  </div>
                  <div className="lp-result-row is-next">
                    <CheckCircle2 size={16} strokeWidth={1.8} />
                    <div>
                      <strong>The duck asks</strong>
                      <p>{feedback.question}</p>
                    </div>
                    <span className="sk-note is-next" aria-hidden="true">← answer this next</span>
                  </div>
                  <button className="sk-type-link sk-again" type="button" onClick={replay}>
                    <RotateCcw size={16} strokeWidth={1.8} />
                    Play again
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <p className="sk-live-note lp-reveal">
          <span className="sk-pill">Coming soon</span>
          <a href="#live">Live mode: talk it through hands-free, and the duck asks back out loud.</a>
        </p>
      </div>
    </section>
  );
}
