"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Mic, Pause, Square } from "lucide-react";
import { DuckMascot, type DuckMood } from "./DuckMascot";

type Beat = {
  mood: DuckMood;
  status: string;
  caption: string;
  speaker: "student" | "duck";
  score: number;
  gap: "pending" | "found" | "fixed";
};

// One scripted Live mode exchange, looped. This is a concept of the planned 2027 feature.
const beats: Beat[] = [
  {
    mood: "listening",
    status: "Listening",
    speaker: "student",
    caption: "So cardiac output is heart rate times stroke volume, and when you exercise both of them go up…",
    score: 54,
    gap: "pending",
  },
  {
    mood: "thinking",
    status: "Finding the gap",
    speaker: "student",
    caption: "…so the heart pumps more blood each minute.",
    score: 54,
    gap: "pending",
  },
  {
    mood: "asking",
    status: "Asking",
    speaker: "duck",
    caption: "Good. But why does stroke volume go up during exercise?",
    score: 62,
    gap: "found",
  },
  {
    mood: "listening",
    status: "Listening",
    speaker: "student",
    caption: "More blood comes back to the heart, so it stretches more and contracts harder.",
    score: 78,
    gap: "fixed",
  },
];

const BEAT_MS = 3800;

const concepts = [
  { label: "Cardiac output", status: "clear" },
  { label: "Stroke volume", status: "improving" },
  { label: "Preload", status: "gap_found" },
  { label: "Afterload", status: "not_started" },
];

export function LiveModeSection() {
  const [beatIndex, setBeatIndex] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const beat = beats[beatIndex];

  // Only play the loop while the concept is on screen, and not at all for reduced motion.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setBeatIndex(2);
      return;
    }

    let timer: number | undefined;
    const observer = new IntersectionObserver(([entry]) => {
      window.clearInterval(timer);
      if (entry.isIntersecting) {
        timer = window.setInterval(() => setBeatIndex((current) => (current + 1) % beats.length), BEAT_MS);
      }
    });
    observer.observe(stage);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, []);

  return (
    <section className="lp-section sk-panel is-ink" id="live">
      <div className="lp-wrap sk-live">
        <div className="sk-live-copy lp-reveal">
          <span className="sk-pill">Coming 2027</span>
          <h2>Live mode. Just talk it through.</h2>
          <p>
            Open a concept from your notes and explain it out loud, for as long as you need. The duck waits
            for you to pause, then asks one question about the biggest gap, out loud. Your score and the gap
            stay on screen while you talk.
          </p>
          <ul>
            <li>
              <strong>No buttons.</strong> It hears when you start and when you stop.
            </li>
            <li>
              <strong>Grounded in your notes.</strong> The same engine that checks typed explanations.
            </li>
            <li>
              <strong>Practise how you&apos;re examined.</strong> Vivas and OSCE stations are spoken, so this is too.
            </li>
          </ul>
        </div>

        <div className="sk-live-app lp-reveal" ref={stageRef}>
          <div className="sk-live-bar">
            <span className="sk-live-dot">Live</span>
            <span>Cardiology · Cardiac output</span>
            <span className="sk-live-time">04:12</span>
          </div>

          <div className="sk-live-body">
            <div className="sk-live-stage">
              <DuckMascot mood={beat.mood} size={200} />
              <span className="sk-live-status" aria-live="polite">
                {beat.status}
              </span>
              <p className={`sk-live-caption is-${beat.speaker}`} key={beatIndex}>
                <b>{beat.speaker === "duck" ? "Feynduck" : "You"}</b>
                {beat.caption}
              </p>
            </div>

            <aside className="sk-live-rail">
              <div className="sk-live-card">
                <span>Clarity</span>
                <div className="sk-live-score">
                  <strong>{beat.score}</strong>
                  <small>/100</small>
                </div>
                <div className="sk-live-meter">
                  <span style={{ width: `${beat.score}%` }} />
                </div>
              </div>
              <div className={`sk-live-card is-gap is-${beat.gap}`}>
                <span>
                  <AlertTriangle size={14} strokeWidth={2} />
                  {beat.gap === "pending" ? "Listening for gaps" : beat.gap === "fixed" ? "Gap closed" : "Gap found"}
                </span>
                <p>
                  {beat.gap === "pending"
                    ? "The duck waits until you pause."
                    : "Why stroke volume rises: more venous return stretches the heart (preload)."}
                </p>
              </div>
              <div className="sk-live-card">
                <span>This session</span>
                <ul className="sk-live-concepts">
                  {concepts.map((concept) => (
                    <li key={concept.label}>
                      <span
                        className="fd-dot is-sm"
                        data-status={
                          concept.label === "Preload" && beat.gap === "fixed" ? "improving" : concept.status
                        }
                      />
                      {concept.label}
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>

          <div className="sk-live-controls">
            <span className="sk-live-wave" aria-hidden="true">
              {Array.from({ length: 40 }, (_, index) => (
                <span key={index} style={{ animationDelay: `${(index % 7) * 0.11}s` }} />
              ))}
            </span>
            <span className="sk-live-btn is-mic" aria-hidden="true">
              <Mic size={20} strokeWidth={2} />
            </span>
            <span className="sk-live-btn" aria-hidden="true">
              <Pause size={18} strokeWidth={2} />
            </span>
            <span className="sk-live-btn" aria-hidden="true">
              <Square size={14} strokeWidth={2.4} fill="currentColor" />
            </span>
          </div>
          <p className="sk-live-caveat">Design concept. Live mode is in development.</p>
        </div>
      </div>
    </section>
  );
}
