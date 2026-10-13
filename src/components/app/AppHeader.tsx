"use client";

import { Fragment, useEffect, useState } from "react";
import { LayoutGrid, LogOut, Moon, Sun } from "lucide-react";
import type { AuthenticatedUser } from "@src/lib/auth";
import { useThemeMode } from "@src/lib/useThemeMode";
import { Menu } from "./Menu";

export type Crumb = { label: string; href?: string };

export function Brand({ href = "/study", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <a href={href} className="fd-brand" aria-label={compact ? "Feynduck home" : undefined}>
      <img src="/feynduckhead.png" alt="" width={30} height={30} />
      {compact ? null : <span>Feynduck</span>}
    </a>
  );
}

export function ThemeToggle() {
  const { themeMode, toggleTheme, mounted } = useThemeMode();
  const isDark = mounted && themeMode === "obsidian";

  return (
    <button
      type="button"
      className="fd-icon-btn"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      {isDark ? <Sun size={16} strokeWidth={1.8} /> : <Moon size={16} strokeWidth={1.8} />}
    </button>
  );
}

function getInitial(user?: AuthenticatedUser) {
  const source = user?.displayName || user?.email || "";
  return source.trim().charAt(0).toUpperCase() || "?";
}

export function AccountMenu({ authUser, small = false }: { authUser?: AuthenticatedUser; small?: boolean }) {
  const { themeMode, toggleTheme, mounted } = useThemeMode();
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const isDark = mounted && themeMode === "obsidian";

  useEffect(() => {
    if (!signOutError) return;
    const timer = window.setTimeout(() => setSignOutError(null), 4000);
    return () => window.clearTimeout(timer);
  }, [signOutError]);

  if (!authUser) return null;

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
    <>
      <Menu
        label="Account menu"
        trigger={getInitial(authUser)}
        triggerClassName={small ? "fd-avatar fd-avatar-sm" : "fd-avatar"}
        header={
          <div className="fd-menu-header">
            <strong>{authUser.displayName || "Your account"}</strong>
            {authUser.email ? <span>{authUser.email}</span> : null}
          </div>
        }
        items={[
          {
            label: "Study rooms",
            icon: <LayoutGrid size={16} strokeWidth={1.8} />,
            onSelect: () => {
              window.location.href = "/study";
            },
          },
          {
            label: isDark ? "Light mode" : "Dark mode",
            icon: isDark ? <Sun size={16} strokeWidth={1.8} /> : <Moon size={16} strokeWidth={1.8} />,
            onSelect: toggleTheme,
          },
          {
            label: "Sign out",
            icon: <LogOut size={16} strokeWidth={1.8} />,
            onSelect: () => void handleSignOut(),
          },
        ]}
      />
      {signOutError ? <div className="fd-toast" role="alert">{signOutError}</div> : null}
    </>
  );
}

export function AppHeader({
  authUser,
  crumbs = [],
}: {
  authUser?: AuthenticatedUser;
  crumbs?: Crumb[];
}) {
  return (
    <header className="fd-header">
      <div className="fd-header-inner">
        <div className="fd-header-left">
          <Brand />
          {crumbs.length ? (
            <>
              <span aria-hidden="true" className="fd-crumb-sep" style={{ color: "var(--fd-ring-strong)" }}>/</span>
              <nav aria-label="Breadcrumb" className="fd-crumbs">
                {crumbs.map((crumb, index) => {
                  const isLast = index === crumbs.length - 1;
                  return (
                    <Fragment key={`${crumb.label}-${index}`}>
                      {index > 0 ? <span aria-hidden="true" className="fd-crumb-sep fd-crumb-hide-sm">/</span> : null}
                      {isLast || !crumb.href ? (
                        <span className="fd-crumb-current" aria-current={isLast ? "page" : undefined}>{crumb.label}</span>
                      ) : (
                        <a href={crumb.href} className="fd-crumb-hide-sm">{crumb.label}</a>
                      )}
                    </Fragment>
                  );
                })}
              </nav>
            </>
          ) : null}
        </div>
        <div className="fd-header-right">
          <ThemeToggle />
          <AccountMenu authUser={authUser} />
        </div>
      </div>
    </header>
  );
}
