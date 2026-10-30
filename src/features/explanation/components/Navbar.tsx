"use client";

import { ArrowRight } from "lucide-react";
import { Brand, ThemeToggle } from "@src/components/app/AppHeader";
import { trackEvent } from "@src/lib/analytics";

export function Navbar({ studyHref = "/start" }: { studyHref?: string }) {
  return (
    <header className="fd-header">
      <div className="fd-header-inner">
        <div className="fd-header-left">
          <Brand href="#top" />
          <nav className="lp-nav" aria-label="Page sections">
            <a href="#how">How it works</a>
            <a href="#method">The method</a>
            <a href="#pricing">Pricing</a>
            <a href="#waitlist">Waitlist</a>
          </nav>
        </div>
        <div className="fd-header-right">
          <ThemeToggle />
          <a
            className="fd-btn fd-btn-accent fd-btn-md"
            href={studyHref}
            onClick={() => trackEvent("cta_clicked", { location: "nav", href: studyHref })}
          >
            Study with Feynduck
            <ArrowRight className="fd-arrow" size={15} strokeWidth={2} />
          </a>
        </div>
      </div>
    </header>
  );
}
