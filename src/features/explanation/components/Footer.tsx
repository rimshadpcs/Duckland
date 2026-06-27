"use client";

import { Duck } from "./Duck";
import { Heart, Moon, Sun } from "lucide-react";
import { trackEvent } from "@src/lib/analytics";

export function Footer({
  studyHref = "/start",
  themeMode,
  toggleTheme,
}: {
  studyHref?: string;
  themeMode: "light" | "obsidian";
  toggleTheme: () => void;
}) {
  return (
    <footer className="footer">
      <div className="footer-brand-block">
        <a className="brand" href="#top">
          <Duck />
          <span>Feynduck Ai</span>
        </a>
        <p>Explain what you know. Find what you missed.</p>
      </div>

      <nav className="footer-link-group" aria-label="Product links">
        <span>Product</span>
        <a href="#how">How it works</a>
        <a href="#preview">Preview</a>
        <a href="#pricing">Pricing</a>
        <a href="/#waitlist">Waitlist</a>
        <a href={studyHref} onClick={() => trackEvent("cta_clicked", { location: "footer", href: studyHref })}>
          Start studying
        </a>
      </nav>

      <nav className="footer-link-group footer-trust-group" aria-label="Trust and contact links">
        <span>Trust</span>
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
        <a href="mailto:hello@feynduck.ai?subject=Feynduck%20contact">Contact</a>
        <a
          href="mailto:hello@feynduck.ai?subject=Institution%20plan"
          onClick={() => trackEvent("book_call_clicked", { location: "footer" })}
        >
          Book a call
        </a>
        <button
          aria-label={
            themeMode === "obsidian"
              ? "Switch to light mode"
              : "Switch to dark mode"
          }
          aria-pressed={themeMode === "obsidian"}
          className="theme-switch"
          onClick={toggleTheme}
          type="button"
        >
          {themeMode === "obsidian" ? <Sun size={15} /> : <Moon size={15} />}
          <span>{themeMode === "obsidian" ? "Light mode" : "Dark mode"}</span>
        </button>
      </nav>

      <p className="footer-belief">
        Built for students who want understanding, not fake confidence.
        <Heart size={15} fill="currentColor" aria-hidden="true" />
      </p>
    </footer>
  );
}
