export const metadata = {
  title: "Privacy | Feynduck",
};

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <section className="legal-shell">
        <a className="legal-back-link" href="/">
          Back to Feynduck
        </a>
        <p className="legal-label">Privacy</p>
        <h1>Privacy Policy</h1>
        <p className="legal-updated">Last updated: June 27, 2026</p>

        <div className="legal-content">
          <h2>What we collect</h2>
          <p>
            If you join the waitlist, we collect the details you submit: name, school,
            study area, email address, source, and submission time. If you create an
            account, we collect the information needed to run your study workspace.
          </p>

          <h2>How we use it</h2>
          <p>
            We use waitlist details to contact you about Feynduck access, product updates,
            and relevant study or institution pilots. We use account and study data to
            provide the product experience.
          </p>

          <h2>Where it is stored</h2>
          <p>
            Feynduck uses Supabase for authentication and database storage. We do not sell
            your waitlist information.
          </p>

          <h2>Analytics</h2>
          <p>
            We may track product and landing-page events, such as CTA clicks or waitlist
            submissions, to understand what is working and improve the product.
          </p>

          <h2>Your choices</h2>
          <p>
            To ask for removal from the waitlist or request changes to your information,
            email <a href="mailto:hello@feynduck.ai">hello@feynduck.ai</a>.
          </p>
        </div>
      </section>
    </main>
  );
}
