"use client";

import { ArrowRight } from "lucide-react";
import { trackEvent } from "@src/lib/analytics";
import { useThemeMode } from "@src/lib/useThemeMode";
import { HandUnderline } from "./HandMarks";

export function HeroSection({ studyHref = "/start" }: { studyHref?: string }) {
  const { themeMode, mounted } = useThemeMode();
  const isDark = mounted && themeMode === "obsidian";

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
            Try it on a real question
          </a>
        </div>
      </div>

      <figure className="sk-hero-art lp-reveal">
        <img
          src={isDark ? "/feynduck_hero_dark.webp" : "/feynduck_hero.webp"}
          alt="A teacher in the style of Richard Feynman explaining A to B to C at a blackboard, with a rubber duck on the chalk ledge"
          width={1254}
          height={1254}
        />
      </figure>
    </section>
  );
}
