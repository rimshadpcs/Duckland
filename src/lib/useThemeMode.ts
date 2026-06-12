import { useState, useEffect } from "react";

export type ThemeMode = "light" | "obsidian";

export function useThemeMode() {
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = window.localStorage.getItem("feynduck-theme");
    if (savedTheme === "obsidian" || savedTheme === "light") {
      setThemeMode(savedTheme);
    }
  }, []);

  useEffect(() => {
    if (mounted) {
      document.documentElement.dataset.theme = themeMode;
      window.localStorage.setItem("feynduck-theme", themeMode);
    }
  }, [themeMode, mounted]);

  const toggleTheme = () => {
    setThemeMode((current) => (current === "obsidian" ? "light" : "obsidian"));
  };

  return { themeMode, toggleTheme, mounted };
}
