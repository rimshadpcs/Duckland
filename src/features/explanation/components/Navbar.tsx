"use client";

import { Duck } from "./Duck";
import { Moon, Sun } from "lucide-react";
import { trackEvent } from "@src/lib/analytics";

export function Navbar({
  themeMode,
  toggleTheme,
  studyHref = "/start",
}: {
  themeMode: "light" | "obsidian";
  toggleTheme: () => void;
  studyHref?: string;
}) {
  return (
    <nav className="nav">
      <a className="brand" href="#top" aria-label="Feynduck home">
        <Duck />
        <span>Feynduck Ai</span>
      </a>
      <div className="nav-links">
        <a href="#how">How it works</a>
        <a href="#method">The method</a>
        <a href="#pricing">Pricing</a>
        <a href="/#waitlist">Waitlist</a>
      </div>
      <div className="nav-actions">
        <button
          aria-label={
            themeMode === "obsidian"
              ? "Switch to light mode"
              : "Switch to dark mode"
          }
          aria-pressed={themeMode === "obsidian"}
          className="theme-icon-switch"
          onClick={toggleTheme}
          type="button"
        >
          {themeMode === "obsidian" ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <a className="nav-cta" href={studyHref} onClick={() => trackEvent("cta_clicked", { location: "nav", href: studyHref })}>
          Study with Feynduck →
        </a>
      </div>
    </nav>
  );
}
