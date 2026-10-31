"use client";

import { Heart, Moon, Sun } from "lucide-react";
import { Brand } from "@src/components/app/AppHeader";
import { trackEvent } from "@src/lib/analytics";
import { useThemeMode } from "@src/lib/useThemeMode";

export function Footer({ studyHref = "/start" }: { studyHref?: string }) {
  const { themeMode, toggleTheme, mounted } = useThemeMode();
  const isDark = mounted && themeMode === "obsidian";

  return (
    <footer className="lp-footer">
      <div className="lp-wrap lp-footer-inner">
        <div>
          <Brand href="#top" />
          <p>Explain what you know. Find what you missed.</p>
        </div>

        <nav aria-label="Product links">
          <span className="fd-eyebrow">Product</span>
          <a className="fd-text-link" href="#how">How it works</a>
          <a className="fd-text-link" href="#preview">Preview</a>
          <a
            className="fd-text-link"
            href={studyHref}
            onClick={() => trackEvent("cta_clicked", { location: "footer", href: studyHref })}
          >
            Join the waitlist
          </a>
        </nav>

        <nav aria-label="Trust and contact links">
          <span className="fd-eyebrow">Trust</span>
          <a className="fd-text-link" href="/privacy">Privacy</a>
          <a className="fd-text-link" href="/terms">Terms</a>
          <a className="fd-text-link" href="mailto:hello@feynduck.ai?subject=Feynduck%20contact">Contact</a>
          <a
            className="fd-text-link"
            href="mailto:hello@feynduck.ai?subject=Institution%20plan"
            onClick={() => trackEvent("book_call_clicked", { location: "footer" })}
          >
            Book a call
          </a>
          <button
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            aria-pressed={isDark}
            className="fd-btn fd-btn-ghost fd-btn-sm"
            onClick={toggleTheme}
            type="button"
          >
            {isDark ? <Sun size={15} strokeWidth={1.8} /> : <Moon size={15} strokeWidth={1.8} />}
            {isDark ? "Light mode" : "Dark mode"}
          </button>
        </nav>
      </div>

      <div className="lp-wrap">
        <p className="lp-footer-base">
          Built for students who want understanding, not fake confidence.
          <Heart size={14} fill="currentColor" aria-hidden="true" />
        </p>
      </div>
    </footer>
  );
}
