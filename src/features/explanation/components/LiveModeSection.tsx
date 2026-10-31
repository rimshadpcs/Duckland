"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Pause, Square } from "lucide-react";
import { DuckMascot, type DuckMood } from "./DuckMascot";

type Beat = {
  mood: DuckMood;
  status: string;
  speaker: "student" | "duck";
  caption: string;
  score: number | null;
  notes: number;
};

// Sarah's session from the Live mode overview, looped. Live mode is in development, so this is a concept.
const beats: Beat[] = [
  {
    mood: "listening",
    status: "Listening",
    speaker: "student",
    caption: "The heart is a muscle, and it pumps blood around the body. The blood goes to the lungs through the aorta…",
    score: null,
    notes: 0,
  },
  {
    mood: "asking",
    status: "Wrong fact · straight away",
    speaker: "duck",
    caption: "Quick check! Your notes name a different tube going to the lungs. Which one is it?",
    score: null,
    notes: 1,
  },
  {
    mood: "listening",
    status: "Listening",
    speaker: "student",
    caption: "Oh, the pulmonary artery. And the heart uses its electrical system to beat…",
    score: null,
    notes: 1,
  },
  {
    mood: "asking",
    status: "Fancy word · tiny nudge",
    speaker: "duck",
    caption: "What do you mean by ‘electrical system’?",
    score: null,
    notes: 2,
  },
  {
    mood: "listening",
    status: "Listening · noting quietly",
    speaker: "student",
    caption: "…the blood gets oxygen in the lungs, and then it goes to the body.",
    score: null,
    notes: 3,
  },
  {
    mood: "thinking",
    status: "Finding the biggest gap",
    speaker: "student",
    caption: "That's it, I'm done.",
    score: 54,
    notes: 3,
  },
  {
    mood: "asking",
    status: "One question",
    speaker: "duck",
    caption: "So the blood leaves the lungs full of oxygen. How does it get from there to your toes?",
    score: 54,
    notes: 3,
  },
  {
    mood: "listening",
    status: "Listening",
    speaker: "student",
    caption: "Oh! It has to go back into the heart first, to be pumped out again.",
    score: 81,
    notes: 4,
  },
];

const BEAT_MS = 3800;

const duckNotes = [
  { label: "Wrong fact: “through the aorta”", when: "asked straight away" },
  { label: "Fancy word: “electrical system”", when: "tiny nudge" },
  { label: "Skipped: blood goes back to the heart", when: "saved for the end" },
  { label: "She found the gap herself", when: "Clarity 54 → 81" },
];

const rules = [
  { hears: "A wrong fact, against your own notes", example: "“Through the aorta”", when: "Straight away", now: true },
  { hears: "A fancy word hiding a gap", example: "“Electrical system”", when: "Straight away, with a tiny nudge", now: true },
  { hears: "A missing step", example: "Skipping the return to the heart", when: "After you finish", now: false },
  { hears: "Too simple overall", example: "“The heart pumps blood”", when: "After you finish", now: false },
];

export function LiveModeSection() {
  const [beatIndex, setBeatIndex] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const beat = beats[beatIndex];

  // Only play the loop while the concept is on screen, and not at all for reduced motion.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setBeatIndex(6);
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
          <span className="sk-pill">Coming soon</span>
          <h2>Live mode. Just talk it through.</h2>
          <p>
            Explain a concept out loud and the duck listens, checking every word against your own notes. When
            it speaks up depends on what it hears.
          </p>
          <div className="sk-rules" role="table" aria-label="When the duck speaks">
            {rules.map((rule) => (
              <div className="sk-rule" role="row" key={rule.hears}>
                <div role="cell">
                  <strong>{rule.hears}</strong>
                  <span>{rule.example}</span>
                </div>
                <span role="cell" className={`sk-rule-when ${rule.now ? "is-now" : ""}`}>
                  {rule.when}
                </span>
              </div>
            ))}
          </div>
          <p className="sk-live-why">
            Missing steps wait until the end on purpose. If the duck told you straight away, you&apos;d just copy
            the answer. Finding the gap yourself is when it sticks.
          </p>
        </div>

        <div className="sk-live-app lp-reveal" ref={stageRef}>
          <div className="sk-live-bar">
            <span className="sk-live-dot">Live</span>
            <span>Cardiology · How the heart pumps blood</span>
            <span className="sk-live-time">03:48</span>
          </div>

          <div className="sk-live-body">
            <div className="sk-live-stage">
              <DuckMascot mood={beat.mood} size={200} />
              <span className="sk-live-status" aria-live="polite">
                {beat.status}
              </span>
              <p className={`sk-live-caption is-${beat.speaker}`} key={beatIndex}>
                <b>{beat.speaker === "duck" ? "Feynduck" : "Sarah"}</b>
                {beat.caption}
              </p>
            </div>

            <aside className="sk-live-rail">
              <div className="sk-live-card">
                <span>Clarity</span>
                {beat.score === null ? (
                  <p>Scored when you finish.</p>
                ) : (
                  <>
                    <div className="sk-live-score">
                      <strong>{beat.score}</strong>
                      <small>/100</small>
                    </div>
                    <div className="sk-live-meter">
                      <span style={{ width: `${beat.score}%` }} />
                    </div>
                  </>
                )}
              </div>
              <div className="sk-live-card">
                <span>The duck&apos;s notes</span>
                <ul className="sk-live-notes">
                  {duckNotes.map((note, index) => (
                    <li key={note.label} className={index < beat.notes ? "is-in" : ""}>
                      {note.label}
                      <small>{note.when}</small>
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
