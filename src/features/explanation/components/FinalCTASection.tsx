import { WaitlistForm } from "./WaitlistForm";

export function FinalCTASection() {
  return (
    <section className="lp-wrap" id="waitlist">
      <div className="lp-cta lp-reveal">
        <div>
          <img src="/feynduckhead.png" alt="" width={48} height={48} />
          <h2>Make sure you can explain it yourself.</h2>
          <p>Explain it to Feynduck and find the step you skipped before the exam, interview, or real world does.</p>
        </div>
        <div className="lp-waitlist">
          <p>The duck is taking names. Politely.</p>
          <WaitlistForm source="final_cta_waitlist" variant="app" />
        </div>
      </div>
    </section>
  );
}
