export const metadata = {
  title: "Terms | Feynduck",
};

export default function TermsPage() {
  return (
    <main className="legal-page">
      <section className="legal-shell">
        <a className="legal-back-link" href="/">
          Back to Feynduck
        </a>
        <p className="legal-label">Terms</p>
        <h1>Terms of Use</h1>
        <p className="legal-updated">Last updated: June 27, 2026</p>

        <div className="legal-content">
          <h2>Using Feynduck</h2>
          <p>
            Feynduck is an educational study tool. It is designed to help students explain,
            inspect, and improve their understanding. It is not a substitute for professional,
            academic, medical, legal, or financial advice.
          </p>

          <h2>Waitlist</h2>
          <p>
            Joining the waitlist does not guarantee access by a specific date. We may contact
            you about early access, product updates, or institution pilots.
          </p>

          <h2>Accounts and content</h2>
          <p>
            If you create an account, you are responsible for the material you upload and the
            explanations you submit. Do not upload content you do not have the right to use.
          </p>

          <h2>Product availability</h2>
          <p>
            Feynduck may change, pause, or remove features as the product develops. Private
            testing and early access features may be incomplete.
          </p>

          <h2>Contact</h2>
          <p>
            Questions about these terms can be sent to{" "}
            <a href="mailto:hello@feynduck.ai">hello@feynduck.ai</a>.
          </p>
        </div>
      </section>
    </main>
  );
}
