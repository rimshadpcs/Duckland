"use client";

import { useState, useEffect } from "react";
import { AppNavbar } from "./AppNavbar";
import { ExplainForm } from "./ExplainForm";
import type { AuthenticatedUser } from "@src/lib/auth";
import type { SourceRow } from "@src/lib/repositories/sources";
import type { RoomConceptRow } from "@src/lib/repositories/study-path";
import type { StudyRoomRow } from "@src/lib/repositories/study-rooms";
import type { Json } from "@src/types/database";

type ThemeMode = "light" | "obsidian";

export function StudyDemoPage({
  authUser,
  initialRoom,
  initialSources = [],
  initialSessionState,
  initialConcept,
  initialRoomConcepts = [],
  requestedRoomId,
}: {
  authUser?: AuthenticatedUser;
  initialRoom?: StudyRoomRow | null;
  initialSources?: SourceRow[];
  initialSessionState?: Json | null;
  initialConcept?: RoomConceptRow | null;
  initialRoomConcepts?: RoomConceptRow[];
  requestedRoomId?: string | null;
}) {
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
        roomTitle={roomTitle || initialRoom?.title}
        roomSubject={roomSubject || initialConcept?.title || initialRoom?.selected_concept || initialRoom?.description || undefined}
        authUser={authUser}
      />
      <ExplainForm onRoomLoaded={(title, subject) => {
        setRoomTitle(title);
        setRoomSubject(subject);
      }} initialRoom={initialRoom} initialSources={initialSources} initialSessionState={initialSessionState} initialConcept={initialConcept} initialRoomConcepts={initialRoomConcepts} requestedRoomId={requestedRoomId} />
    </div>
  );
}
