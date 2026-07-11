"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Lightbulb, Send } from "lucide-react";
import { trackEvent } from "@src/lib/analytics";

export function HeroSection({
  themeMode,
  studyHref = "/start",
}: {
  themeMode: "light" | "obsidian";
  studyHref?: string;
}) {
  const [hasChecked, setHasChecked] = useState(false);

  return (
    <section className="hero" id="top">
      <div className="hero-copy reveal">
        <p className="hero-kicker">Feynman study loop</p>
        <h1>You&apos;ve studied it. But can you explain it?</h1>
        <p>
          AI can help you finish the work without helping you master the subject. Explain a
          concept to Feynduck, uncover the exact gap in your reasoning, and try again until
          the understanding is yours.
        </p>
        <div className="hero-actions">
          <a
            className="button primary"
            href={studyHref}
            onClick={() => trackEvent("cta_clicked", { location: "hero_primary", href: studyHref })}
          >
            Test my understanding
          </a>
          <a
            className="button secondary"
            href="#how"
            onClick={() => trackEvent("cta_clicked", { location: "hero_secondary", href: "#how" })}
          >
            Watch the study loop
          </a>
        </div>
      </div>

      <div className="hero-sandbox reveal" data-theme-preview={themeMode}>
        <div className="sandbox-paper">
          <div className="sandbox-header">
            <span>Live sandbox</span>
            <small>Mock analysis</small>
          </div>
          <div className="sandbox-prompt">
            <Lightbulb size={17} />
            <p>Explain why the heart pumps faster during exercise.</p>
          </div>
          <div className="sandbox-input">
            <p>
              The heart pumps faster because muscles need more oxygen, so blood has to move
              around the body more quickly.
            </p>
          </div>
          <button
            className="sandbox-check"
            type="button"
            onClick={() => {
              setHasChecked(true);
              trackEvent("hero_sandbox_checked");
            }}
          >
            <Send size={15} />
            Check explanation
          </button>

          <div className={`sandbox-analysis ${hasChecked ? "is-visible" : ""}`} aria-live="polite">
            <div className="analysis-row warning">
              <AlertTriangle size={17} />
              <div>
                <strong>Missing causal link</strong>
                <p>You named oxygen demand, but skipped how cardiac output rises.</p>
              </div>
            </div>
            <div className="analysis-row success">
              <CheckCircle2 size={17} />
              <div>
                <strong>Targeted follow-up</strong>
                <p>What changes in heart rate and stroke volume help deliver more blood each minute?</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
