"use client";

import { useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Lightbulb, Send } from "lucide-react";
import { trackEvent } from "@src/lib/analytics";

export function HeroSection({ studyHref = "/start" }: { studyHref?: string }) {
  const [hasChecked, setHasChecked] = useState(false);

  return (
    <section className="lp-wrap lp-hero" id="top">
      <div className="lp-hero-copy lp-reveal">
        <span className="fd-pill is-amber">
          <span className="fd-dot is-sm" style={{ background: "var(--fd-amber)" }} />
          A better way to test your understanding
        </span>
        <h1>You&apos;ve studied it. But can you explain how and why it works?</h1>
        <p>
          An AI companion that listens to your explanation, checks it against your course
          materials, finds the gap, and asks what you need to think about next.
        </p>
        <div className="lp-actions">
          <a
            className="fd-btn fd-btn-accent fd-btn-xl"
            href={studyHref}
            onClick={() => trackEvent("cta_clicked", { location: "hero_primary", href: studyHref })}
          >
            Test my understanding
            <ArrowRight className="fd-arrow" size={16} strokeWidth={2} />
          </a>
          <a
            className="fd-btn fd-btn-secondary fd-btn-xl"
            href="#how"
            onClick={() => trackEvent("cta_clicked", { location: "hero_secondary", href: "#how" })}
          >
            Watch the study loop
          </a>
        </div>
      </div>

      <div className="lp-sandbox lp-reveal">
        <div className="lp-sandbox-head">
          <div>
            <img src="/feynduckhead.png" alt="" width={22} height={22} />
            Live sandbox
          </div>
          <span className="fd-kicker">Mock analysis</span>
        </div>
        <div className="lp-sandbox-body">
          <div className="fd-ask">
            <Lightbulb size={16} strokeWidth={1.8} />
            <div>
              <span>Explain this</span>
              <span>Explain why the heart pumps faster during exercise.</span>
            </div>
          </div>
          <div className="fd-composer">
            <span className="fd-composer-label">Your explanation</span>
            <p>
              The heart pumps faster because muscles need more oxygen, so blood has to move
              around the body more quickly.
            </p>
            <div className="fd-composer-foot">
              <span className="fd-hint">19 words</span>
              <button
                className="fd-btn fd-btn-dark fd-btn-sm"
                type="button"
                onClick={() => {
                  setHasChecked(true);
                  trackEvent("hero_sandbox_checked");
                }}
              >
                <Send size={14} strokeWidth={2} />
                Check explanation
              </button>
            </div>
          </div>

          <div className={`lp-sandbox-result ${hasChecked ? "is-visible" : ""}`} aria-live="polite">
            <div className="lp-result-row is-gap">
              <AlertTriangle size={16} strokeWidth={1.8} />
              <div>
                <strong>The missing step in your explanation</strong>
                <p>You named oxygen demand, but skipped how the heart sends more blood each minute.</p>
              </div>
            </div>
            <div className="lp-result-row is-next">
              <CheckCircle2 size={16} strokeWidth={1.8} />
              <div>
                <strong>Targeted follow-up question</strong>
                <p>What changes in heart rate and stroke volume help deliver more blood each minute?</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
