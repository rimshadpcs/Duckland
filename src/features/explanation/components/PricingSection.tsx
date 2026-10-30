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
    <section className="lp-section is-band" id="pricing">
      <div className="lp-wrap">
        <SectionHeader
          label="pricing"
          title="Start free. Upgrade when Feynduck becomes your study habit."
          copy="Try the explanation loop for free. Upgrade when you want unlimited practice, deeper gap feedback, and study history across subjects."
        />

        <div className="lp-billing lp-reveal">
          <div className="fd-segmented" role="tablist" aria-label="Billing cycle">
            {(["monthly", "annual"] as const).map((cycle) => (
              <button
                aria-selected={billingCycle === cycle}
                key={cycle}
                onClick={() => setBillingCycle(cycle)}
                role="tab"
                type="button"
              >
                {cycle === "monthly" ? "Monthly" : "Annual"}
              </button>
            ))}
          </div>
          <span className="fd-pill is-amber">Save up to 33% yearly</span>
        </div>

        <div className="lp-grid-3">
          {primaryPlans.map((plan) => {
            const { price, priceNote, priceSuffix } = getPlanPrice(plan);

            return (
              <article
                className={`lp-card lp-price-card lp-reveal ${plan.featured ? "is-strong" : ""}`}
                key={plan.name}
              >
                {plan.badge ? (
                  <span className={`fd-pill ${plan.featured ? "is-accent" : "is-amber"}`}>{plan.badge}</span>
                ) : null}
                <div>
                  <h3>{plan.name}</h3>
                  <p>{plan.intro}</p>
                </div>

                <div className="lp-price">
                  {price}
                  {priceSuffix ? <span>{priceSuffix}</span> : null}
                </div>

                <p>{priceNote}</p>

                <ul className="lp-list">
                  {plan.items.map((item) => (
                    <li key={item}>
                      <Check size={15} strokeWidth={2} />
                      {item}
                    </li>
                  ))}
                </ul>
                <a
                  className={`fd-btn fd-btn-lg fd-btn-block ${plan.featured ? "fd-btn-accent" : "fd-btn-secondary"}`}
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
          <article className="lp-card lp-institution lp-reveal">
            <div>
              {institutionPlan.badge ? <span className="fd-pill">{institutionPlan.badge}</span> : null}
              <h3>{institutionPlan.name}</h3>
              <p>{institutionPlan.intro}</p>
            </div>
            <ul className="lp-list">
              {institutionPlan.items.slice(0, 4).map((item) => (
                <li key={item}>
                  <Check size={15} strokeWidth={2} />
                  {item}
                </li>
              ))}
            </ul>
            <div>
              <div className="lp-price">Custom</div>
              <p>{institutionPlan.annualNote}</p>
              <a
                className="fd-btn fd-btn-dark fd-btn-lg"
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

        <p className="lp-pricing-foot lp-reveal">
          The cost of one tutoring session. Lasts all year.
        </p>
      </div>
    </section>
  );
}
