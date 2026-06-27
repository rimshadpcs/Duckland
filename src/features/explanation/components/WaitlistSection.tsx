import { WaitlistForm } from "./WaitlistForm";

export function WaitlistSection() {
  return (
    <section className="section waitlist-section" id="waitlist">
      <div className="waitlist-panel reveal">
        <div className="waitlist-copy">
          <span className="section-label">waitlist</span>
          <h2>Join the Feynduck waitlist.</h2>
          <p>Get early access when new study spots open. No spam. The duck has standards.</p>
        </div>
        <WaitlistForm source="pricing_waitlist" />
      </div>
    </section>
  );
}
