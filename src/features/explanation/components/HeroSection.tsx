"use client";

import { ArrowRight } from "lucide-react";
import { trackEvent } from "@src/lib/analytics";
import { HandUnderline } from "./HandMarks";
import { HeroChain } from "./HeroChain";

export function HeroSection({ studyHref = "/start" }: { studyHref?: string }) {
  return (
    <section className="lp-wrap sk-hero" id="top">
      <div className="sk-hero-copy lp-reveal">
        <h1>
          You&apos;ve studied it. But can you explain{" "}
          <span className="sk-mark">
            how and why
            <HandUnderline />
          </span>{" "}
          it works?
        </h1>
        <p>
          An AI companion that listens to your explanation, checks it against your course
          materials, finds the gap, and asks what you need to think about next.
        </p>
        <div className="sk-actions">
          <a
            className="sk-btn"
            href={studyHref}
            onClick={() => trackEvent("cta_clicked", { location: "hero_primary", href: studyHref })}
          >
            Join the waitlist
            <ArrowRight size={18} strokeWidth={2.2} />
          </a>
          <a
            className="sk-link"
            href="#try"
            onClick={() => trackEvent("cta_clicked", { location: "hero_secondary", href: "#try" })}
          >
            See it catch a gap
          </a>
        </div>
      </div>

      <div className="sk-hero-art lp-reveal">
        <HeroChain />
      </div>
    </section>
  );
}
