"use client";

import { useEffect } from "react";
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
import { UniversityMarquee } from "./UniversityMarquee";
import { AiComparisonSection } from "./AiComparisonSection";

export function LandingPage() {
  useEffect(() => {
    const main = document.querySelector<HTMLElement>(".fd-landing");
    if (!main) return;

    const items = Array.from(main.querySelectorAll<HTMLElement>(".lp-reveal"));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );

    items.forEach((item, index) => {
      item.style.setProperty("--reveal-order", String(index % 4));
      observer.observe(item);
    });
    main.classList.add("is-reveal-ready");
    return () => observer.disconnect();
  }, []);

  const studyHref = "/duck-watch";

  return (
    <main className="fd fd-landing">
      <Navbar studyHref={studyHref} />
      <HeroSection studyHref={studyHref} />
      <UniversityMarquee />
      <AiComparisonSection />
      <QualityProofSection />
      <HowItWorksSection />
      <ProductPreview />
      <MethodSection />
      <ProductFeaturesSection />
      <AudienceSection />
      <PricingSection />
      <FAQSection />
      <FinalCTASection studyHref={studyHref} />
      <Footer studyHref={studyHref} />
    </main>
  );
}
