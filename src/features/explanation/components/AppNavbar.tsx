"use client";

import { Button } from "@src/components/ui";
import { Sun, Moon } from "lucide-react";

export function AppNavbar({
  themeMode,
  toggleTheme,
  mounted = true,
  isSession = false,
  roomTitle,
  roomSubject,
}: {
  themeMode?: "light" | "obsidian";
  toggleTheme?: () => void;
  mounted?: boolean;
  isSession?: boolean;
  roomTitle?: string;
  roomSubject?: string;
}) {
  return (
    <nav className="app-nav">
      <div className="app-nav-left">
        <div className="app-logo">
          <img src="/feynduckhead.png" alt="" />
          <span>Feynduck</span>
        </div>
        {toggleTheme && (
          <button
            className="theme-switch dashboard-theme-btn"
            onClick={toggleTheme}
            aria-label={themeMode === "obsidian" ? "Switch to light mode" : "Switch to dark mode"}
            type="button"
            style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.2s' }}
          >
            {themeMode === "obsidian" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        )}
      </div>

      {isSession && (
        <div className="app-nav-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--ink)' }}>{roomTitle || "Quick explain"}</span>
          {roomSubject && <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{roomSubject}</span>}
        </div>
      )}

      <div className="app-nav-right">
        {isSession ? (
          <a href="/study" style={{ textDecoration: 'none' }}>
            <Button variant="secondary" className="app-start-btn">
              Back to rooms
            </Button>
          </a>
        ) : (
          <Button variant="secondary" className="app-start-btn" onClick={() => window.location.href = '/study/session'}>
            Start explaining
          </Button>
        )}
      </div>
    </nav>
  );
}
