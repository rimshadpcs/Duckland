import { SectionHeader } from "./SectionHeader";

export function MethodSection({
  themeMode,
}: {
  themeMode: "light" | "obsidian";
}) {
  return (
    <section className="section method-banner" id="method">
      <SectionHeader
        label="the method"
        title="Why Feynduck works."
        copy="Feynman Technique helps you explain. Rubber ducking helps you hear the gap. Feynduck helps you fix it."
      />
      <div className="method-card reveal" aria-label="Feynman Technique, Rubber Ducking, and Feynduck definitions">
        <article>
          <h3>feynman technique</h3>
          <p className="phonetic">/fyn-man tek-neek/ · noun</p>
          <div className="method-rule" />
          <p className="part">definition.</p>
          <blockquote>
            A learning method built around one test: can you explain a concept in plain language,
            as if teaching it to someone who knows nothing? If you stumble, that stumble is the gap.
          </blockquote>
          <p className="method-meta">named after · Richard Feynman</p>
          <p className="see-also">see also · active recall, teaching to learn</p>
        </article>
        <article>
          <h3>rubber ducking</h3>
          <p className="phonetic">/rub-er duk-ing/ · noun</p>
          <div className="method-rule" />
          <p className="part">definition.</p>
          <blockquote>
            The act of explaining a problem step by step to an object. The duck never responds.
            The explaining forces vague thinking into clear steps.
          </blockquote>
          <p className="method-meta">origin · The Pragmatic Programmer</p>
          <p className="see-also">see also · self-explanation, metacognition</p>
        </article>
        <article className="feynduck-definition">
          <h3>feynduck</h3>
          <p className="phonetic">/feyn-duk/ · noun</p>
          <div className="method-rule" />
          <p className="part">definition.</p>
          <blockquote>
            The duck that talks back. An AI study companion that makes you explain a concept in
            your own words, finds where your reasoning breaks, and asks the one question that helps
            you fix it yourself.
          </blockquote>
          <p className="see-also">see also · understanding, not memorisation</p>
        </article>
      </div>
      <div className="method-banner-image reveal">
        <img
          src={themeMode === "obsidian" ? "/wide_banner_dark.png" : "/wide_banner.png"}
          alt="Feynduck workflow diagram"
        />
      </div>
    </section>
  );
}
