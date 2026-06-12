import { Duck } from "./Duck";
import { Moon, Sun } from "lucide-react";

export function Navbar({
  themeMode,
  toggleTheme,
}: {
  themeMode: "light" | "obsidian";
  toggleTheme: () => void;
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
        <a className="nav-cta" href="/study">
          Study with Feynduck →
        </a>
      </div>
    </nav>
  );
}
