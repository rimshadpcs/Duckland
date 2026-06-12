"use client";

import { useState, useEffect } from "react";
import { AppNavbar } from "./AppNavbar";
import { ExplainForm } from "./ExplainForm";

type ThemeMode = "light" | "obsidian";

export function StudyDemoPage() {
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");
  const [mounted, setMounted] = useState(false);
  const [roomTitle, setRoomTitle] = useState<string | undefined>();
  const [roomSubject, setRoomSubject] = useState<string | undefined>();

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

  return (
    <div className="app-workspace">
      <AppNavbar 
        themeMode={themeMode} 
        toggleTheme={toggleTheme} 
        mounted={mounted} 
        isSession={true}
        roomTitle={roomTitle}
        roomSubject={roomSubject}
      />
      <ExplainForm onRoomLoaded={(title, subject) => {
        setRoomTitle(title);
        setRoomSubject(subject);
      }} />
    </div>
  );
}
