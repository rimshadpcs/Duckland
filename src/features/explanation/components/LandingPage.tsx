"use client";

import { useEffect, useState } from "react";
import { AudienceSection } from "./AudienceSection";
import { FAQSection } from "./FAQSection";
import { FinalCTASection } from "./FinalCTASection";
import { Footer } from "./Footer";
import { HeroSection } from "./HeroSection";
import { HowItWorksSection } from "./HowItWorksSection";
import { MethodSection } from "./MethodSection";
import { Navbar } from "./Navbar";
import { PricingSection } from "./PricingSection";
import { ProductFeaturesSection } from "./ProductFeaturesSection";
import { ProductPreview } from "./ProductPreview";
import { QualityProofSection } from "./QualityProofSection";

type ThemeMode = "light" | "obsidian";

export function LandingPage() {
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const items = Array.from(document.querySelectorAll<HTMLElement>(".landing-page .reveal"));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.16 },
    );

    items.forEach((item, index) => {
      item.style.setProperty("--reveal-order", String(index % 5));
      observer.observe(item);
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const main = document.querySelector<HTMLElement>(".landing-page");
    if (!main) return;

    let animationFrame = 0;
    const updateScrollProgress = () => {
      animationFrame = 0;
      const scrollable = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      const progress = Math.min(window.scrollY / scrollable, 1);
      main.style.setProperty("--landing-scroll", progress.toFixed(4));
    };

    const requestUpdate = () => {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(updateScrollProgress);
    };

    updateScrollProgress();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);

    return () => {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, []);

  useEffect(() => {
    setMounted(true);
    const savedTheme = window.localStorage.getItem("feynduck-theme");
    if (savedTheme === "obsidian" || savedTheme === "light") {
      setThemeMode(savedTheme);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.dataset.theme = themeMode;
    window.localStorage.setItem("feynduck-theme", themeMode);
  }, [themeMode, mounted]);

  const toggleTheme = () => {
    setThemeMode((current) => (current === "obsidian" ? "light" : "obsidian"));
  };

  return (
    <main className="landing-page">
      <Navbar themeMode={themeMode} toggleTheme={toggleTheme} />
      <HeroSection themeMode={themeMode} />
      <QualityProofSection />
      <HowItWorksSection />
      <ProductPreview />
      <MethodSection themeMode={themeMode} />
      <ProductFeaturesSection />
      <AudienceSection />
      <PricingSection />
      <FAQSection />
      <FinalCTASection />
      <Footer themeMode={themeMode} toggleTheme={toggleTheme} />
    </main>
  );
}
