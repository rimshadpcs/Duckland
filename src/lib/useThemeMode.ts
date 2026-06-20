import { useState, useEffect } from "react";

export type ThemeMode = "light" | "obsidian";

export function useThemeMode() {
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const savedTheme = window.localStorage.getItem("feynduck-theme");
      if (savedTheme === "obsidian" || savedTheme === "light") {
        setThemeMode(savedTheme);
      }
    } catch {
      setThemeMode("light");
    }
  }, []);

  useEffect(() => {
    if (mounted) {
      document.documentElement.dataset.theme = themeMode;
      try {
        window.localStorage.setItem("feynduck-theme", themeMode);
      } catch {
        // Theme still applies for this render; persistence is optional.
      }
    }
  }, [themeMode, mounted]);

  const toggleTheme = () => {
    setThemeMode((current) => (current === "obsidian" ? "light" : "obsidian"));
  };

  return { themeMode, toggleTheme, mounted };
}
