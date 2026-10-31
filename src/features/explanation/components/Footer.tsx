"use client";

import { ArrowRight, Moon, Sun } from "lucide-react";
import { Brand } from "@src/components/app/AppHeader";
import { trackEvent } from "@src/lib/analytics";
import { useThemeMode } from "@src/lib/useThemeMode";
import { DuckRun } from "./DuckRun";

export function Footer({ studyHref = "/start" }: { studyHref?: string }) {
  const { themeMode, toggleTheme, mounted } = useThemeMode();
  const isDark = mounted && themeMode === "obsidian";

  return (
    <footer className="sk-footer">
      <div className="lp-wrap sk-footer-top">
        <Brand href="#top" />

        <div className="sk-footer-cta">
          <a
            className="sk-footer-box"
            href={studyHref}
            onClick={() => trackEvent("cta_clicked", { location: "footer", href: studyHref })}
          >
            Join the waitlist
            <ArrowRight size={18} strokeWidth={2.2} />
          </a>
          <p>Explain what you know. Find what you missed.</p>
        </div>

        <p className="sk-footer-copy">© {new Date().getFullYear()} Feynduck</p>
      </div>

      <nav className="lp-wrap sk-footer-links" aria-label="Footer links">
        <button
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          aria-pressed={isDark}
          className="sk-footer-toggle"
          onClick={toggleTheme}
          type="button"
        >
          {isDark ? <Sun size={16} strokeWidth={1.8} /> : <Moon size={16} strokeWidth={1.8} />}
          {isDark ? "Light mode" : "Dark mode"}
        </button>
        <a href="#how">How it works</a>
        <a href="#method">The method</a>
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
        <a href="mailto:hello@feynduck.ai?subject=Feynduck%20contact">Contact</a>
        <a
          href="mailto:hello@feynduck.ai?subject=Institution%20plan"
          onClick={() => trackEvent("book_call_clicked", { location: "footer" })}
        >
          Book a call
        </a>
      </nav>

      <DuckRun />
    </footer>
  );
}
