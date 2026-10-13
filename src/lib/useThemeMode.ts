import { useSyncExternalStore } from "react";

export type ThemeMode = "light" | "obsidian";

const STORAGE_KEY = "feynduck-theme";
const THEME_EVENT = "feynduck-theme-change";

function readTheme(): ThemeMode {
  return document.documentElement.dataset.theme === "obsidian" ? "obsidian" : "light";
}

function subscribe(onChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    if (event.newValue === "obsidian" || event.newValue === "light") {
      document.documentElement.dataset.theme = event.newValue;
    }
    onChange();
  };

  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener("storage", handleStorage);
  };
}

const subscribeNever = () => () => {};

export function setThemeMode(mode: ThemeMode) {
  document.documentElement.dataset.theme = mode;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Theme still applies for this page; persistence is optional.
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function useThemeMode() {
  const themeMode = useSyncExternalStore<ThemeMode>(subscribe, readTheme, () => "light");
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);

  const toggleTheme = () => {
    setThemeMode(readTheme() === "obsidian" ? "light" : "obsidian");
  };

  return { themeMode, toggleTheme, mounted };
}
