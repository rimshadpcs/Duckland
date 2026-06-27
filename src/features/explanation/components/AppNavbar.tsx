"use client";

import { useState } from "react";
import { Button } from "@src/components/ui";
import { MoreVertical, Sun, Moon } from "lucide-react";
import type { AuthenticatedUser } from "@src/lib/auth";

export function AppNavbar({
  themeMode,
  toggleTheme,
  mounted = true,
  isSession = false,
  roomTitle,
  roomSubject,
  authUser,
}: {
  themeMode?: "light" | "obsidian";
  toggleTheme?: () => void;
  mounted?: boolean;
  isSession?: boolean;
  roomTitle?: string;
  roomSubject?: string;
  authUser?: AuthenticatedUser;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const handleSignOut = async () => {
    setSignOutError(null);
    try {
      const response = await fetch("/auth/signout", { method: "POST" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Could not sign out. Please try again.");
      }
      window.location.href = "/login";
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : "Could not sign out. Please try again.");
    }
  };

  return (
    <nav className="app-nav">
      <div className="app-nav-left">
        {authUser && (
          <div className="account-menu app-overflow-menu">
            <button
              className="account-menu-trigger icon-menu-trigger"
              type="button"
              onClick={() => setIsMenuOpen((current) => !current)}
              aria-label="Open account menu"
              aria-expanded={isMenuOpen}
            >
              <MoreVertical size={18} />
            </button>
            {isMenuOpen && (
              <div className="account-menu-popover app-left-menu-popover">
                <div>
                  <strong>{authUser.displayName || authUser.email || "Account"}</strong>
                  {authUser.displayName && authUser.email ? <span>{authUser.email}</span> : null}
                </div>
                <button type="button" onClick={handleSignOut}>Sign out</button>
                {signOutError ? <p>{signOutError}</p> : null}
              </div>
            )}
          </div>
        )}
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
        <div className="app-nav-center session-breadcrumb" aria-label="Study breadcrumb">
          {roomTitle ? <span className="session-breadcrumb-room">{roomTitle}</span> : <span className="session-breadcrumb-room">Quick explain</span>}
          {roomSubject ? (
            <>
              <span className="session-breadcrumb-separator" aria-hidden="true">›</span>
              <span className="session-breadcrumb-concept">{roomSubject}</span>
            </>
          ) : null}
        </div>
      )}

      <div className="app-nav-right">
        {isSession && (
          <a href="/study" style={{ textDecoration: 'none' }}>
            <Button variant="secondary" className="app-start-btn">
              Back to rooms
            </Button>
          </a>
        )}
      </div>
    </nav>
  );
}
