"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { trackEvent } from "@src/lib/analytics";
import { pricingTiers } from "./LandingPageData";
import { SectionHeader } from "./SectionHeader";

type BillingCycle = "monthly" | "annual";

export function PricingSection() {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("annual");
  const primaryPlans = pricingTiers.filter((plan) => plan.name !== "Institution");
  const institutionPlan = pricingTiers.find((plan) => plan.name === "Institution");

  const getPlanPrice = (plan: (typeof pricingTiers)[number]) => {
    const isAnnual = billingCycle === "annual";
    return {
      price: isAnnual ? plan.annualPrice : plan.monthlyPrice,
      priceNote: isAnnual ? plan.annualNote : plan.monthlyNote,
      priceSuffix: isAnnual ? plan.annualSuffix : plan.monthlySuffix,
    };
  };

  return (
    <section className="section pricing" id="pricing">
      <SectionHeader
        label="pricing"
        title="Start free. Upgrade when Feynduck becomes your study habit."
        copy="Try the explanation loop for free. Upgrade when you want unlimited practice, deeper gap feedback, and study history across subjects."
      />

      <div className="pricing-toggle-wrap reveal">
        <div className="pricing-save-callout" aria-hidden="true">
          <span>❤️ Save More</span>
          <svg viewBox="0 0 76 56" focusable="false">
            <path d="M68 3C64 28 48 44 8 49" />
          </svg>
        </div>
        <div className="pricing-toggle">
          <button
            className={billingCycle === "monthly" ? "active" : ""}
            onClick={() => setBillingCycle("monthly")}
            type="button"
          >
            Monthly
          </button>
          <button
            className={billingCycle === "annual" ? "active" : ""}
            onClick={() => setBillingCycle("annual")}
            type="button"
          >
            Annual
          </button>
        </div>
      </div>

      <div className="pricing-grid">
        {primaryPlans.map((plan) => {
          const { price, priceNote, priceSuffix } = getPlanPrice(plan);

          return (
            <article
              className={`price-card reveal ${plan.featured ? "featured" : ""} ${plan.badge && !plan.featured ? "value-card" : ""}`}
              key={plan.name}
            >
              {plan.badge ? <strong className="badge">{plan.badge}</strong> : null}
              <h3>{plan.name}</h3>
              <p className="price-intro">{plan.intro}</p>

              <div className="price">
                {price}
                {priceSuffix ? <span>{priceSuffix}</span> : null}
              </div>

              <p className="price-savings">{priceNote}</p>

              <ul>
                {plan.items.map((item) => (
                  <li key={item}>
                    <Check size={16} />
                    {item}
                  </li>
                ))}
              </ul>
              <a
                className="button primary"
                href={plan.ctaHref ?? "#top"}
                onClick={() =>
                  trackEvent("pricing_cta_clicked", {
                    plan: plan.name,
                    billingCycle,
                    href: plan.ctaHref ?? "#top",
                  })
                }
              >
                {plan.cta}
              </a>
            </article>
          );
        })}
      </div>

      {institutionPlan ? (
        <article className="institution-card reveal">
          <div className="institution-card-copy">
            {institutionPlan.badge ? <strong className="badge">{institutionPlan.badge}</strong> : null}
            <h3>{institutionPlan.name}</h3>
            <p>{institutionPlan.intro}</p>
          </div>
          <ul>
            {institutionPlan.items.slice(0, 4).map((item) => (
              <li key={item}>
                <Check size={16} />
                {item}
              </li>
            ))}
          </ul>
          <div className="institution-card-action">
            <div className="price">Custom</div>
            <p className="price-savings">{institutionPlan.annualNote}</p>
            <a
              className="button primary"
              href={institutionPlan.ctaHref ?? "#top"}
              onClick={() =>
                trackEvent("pricing_cta_clicked", {
                  plan: institutionPlan.name,
                  billingCycle,
                  href: institutionPlan.ctaHref ?? "#top",
                })
              }
            >
              {institutionPlan.cta}
            </a>
          </div>
        </article>
      ) : null}

      <p className="pricing-footer reveal">
        The cost of one tutoring session. Lasts all year.
      </p>
    </section>
  );
}
