export function HeroSection({
  themeMode,
}: {
  themeMode: "light" | "obsidian";
}) {
  return (
    <section className="hero" id="top">
      <div className="hero-copy reveal">
        <h1>You&apos;ve studied it. But can you explain it?</h1>
        <p>
          Feynduck turns the Feynman Technique into an AI study loop: add your material,
          explain what you understand, and find the missing link before the exam does.
        </p>
        <div className="hero-actions">
          <a className="button primary" href="/study">
            Start studying
          </a>
          <a className="button secondary" href="#how">
            See how it works
          </a>
        </div>
      </div>

      <div className="hero-illustration reveal">
        <img
          src={themeMode === "obsidian" ? "/feynduck_hero_dark.png" : "/feynduck_hero.png"}
          alt="Feynduck study companion hero illustration"
        />
      </div>
    </section>
  );
}
