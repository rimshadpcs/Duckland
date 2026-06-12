import { Duck } from "./Duck";
import { Moon, Sun } from "lucide-react";

export function Footer({
  themeMode,
  toggleTheme,
}: {
  themeMode: "light" | "obsidian";
  toggleTheme: () => void;
}) {
  return (
    <footer className="footer">
      <a className="brand" href="#top">
        <Duck />
        <span>Feynduck Ai</span>
      </a>
      <p>The study buddy that asks, “but why?” in the nicest possible way.</p>
      <div>
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
        <a href="#top">Privacy</a>
        <a href="#top">Terms</a>
        <a href="#top">Contact</a>
      </div>
    </footer>
  );
}
