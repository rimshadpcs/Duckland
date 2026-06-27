"use client";

import { Duck } from "./Duck";
import { WaitlistForm } from "./WaitlistForm";
import { trackEvent } from "@src/lib/analytics";

export function FinalCTASection({ studyHref = "/start" }: { studyHref?: string }) {
  return (
    <section className="final-cta reveal" id="waitlist">
      <Duck />
      <h2>Stop guessing whether you understand.</h2>
      <p>Explain it to Feynduck and find out before the exam does.</p>
      <div className="final-cta-actions">
        <a
          className="button primary"
          href={studyHref}
          onClick={() => trackEvent("cta_clicked", { location: "final_cta", href: studyHref })}
        >
          Study with Feynduck →
        </a>
        <div className="final-waitlist">
          <p>The duck is taking names. Politely.</p>
          <WaitlistForm source="final_cta_waitlist" />
        </div>
      </div>
    </section>
  );
}
