"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { pricingTiers } from "./LandingPageData";
import { SectionHeader } from "./SectionHeader";

type BillingCycle = "monthly" | "annual";

export function PricingSection() {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("annual");

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
        {pricingTiers.map((plan) => {
          const isAnnual = billingCycle === "annual";
          const price = isAnnual ? plan.annualPrice : plan.monthlyPrice;
          const priceSuffix = isAnnual ? plan.annualSuffix : plan.monthlySuffix;
          const priceNote = isAnnual ? plan.annualNote : plan.monthlyNote;

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
              <a className="button primary" href="#top">
                {plan.cta}
              </a>
            </article>
          );
        })}
      </div>

      <p className="pricing-footer reveal">
        The cost of one tutoring session. Lasts all year.
      </p>
    </section>
  );
}
