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
    const items = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
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

    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
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
    <main>
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
