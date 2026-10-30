"use client";

import { ArrowRight } from "lucide-react";
import { WaitlistForm } from "./WaitlistForm";
import { trackEvent } from "@src/lib/analytics";

export function FinalCTASection({ studyHref = "/start" }: { studyHref?: string }) {
  return (
    <section className="lp-wrap" id="waitlist">
      <div className="lp-cta lp-reveal">
        <div>
          <img src="/feynduckhead.png" alt="" width={48} height={48} />
          <h2>Make sure you can explain it yourself.</h2>
          <p>Explain it to Feynduck and find the step you skipped before the exam, interview, or real world does.</p>
          <a
            className="fd-btn fd-btn-accent fd-btn-xl"
            href={studyHref}
            onClick={() => trackEvent("cta_clicked", { location: "final_cta", href: studyHref })}
          >
            Study with Feynduck
            <ArrowRight className="fd-arrow" size={16} strokeWidth={2} />
          </a>
        </div>
        <div className="lp-waitlist">
          <p>The duck is taking names. Politely.</p>
          <WaitlistForm source="final_cta_waitlist" variant="app" />
        </div>
      </div>
    </section>
  );
}
