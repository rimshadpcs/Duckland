"use client";

import { useThemeMode } from "@src/lib/useThemeMode";
import { SectionHeader } from "./SectionHeader";

const definitions = [
  {
    term: "feynman technique",
    phonetic: "/fyn-man tek-neek/ · noun",
    definition:
      "A learning method built around one test: can you explain a concept in plain language, as if teaching it to someone who knows nothing? If you stumble, that stumble is the gap.",
    meta: [
      ["named after", "Richard Feynman"],
      ["see also", "practising from memory, teaching to learn"],
    ],
  },
  {
    term: "rubber ducking",
    phonetic: "/rub-er duk-ing/ · noun",
    definition:
      "The act of explaining a problem step by step to an object. The duck never responds. The explaining forces vague thinking into clear steps.",
    meta: [
      ["origin", "The Pragmatic Programmer"],
      ["see also", "self-explanation, thinking about your own understanding"],
    ],
  },
  {
    term: "feynduck",
    phonetic: "/feyn-duk/ · noun",
    definition:
      "The duck that talks back. An AI companion that listens to your explanation, finds the gap, and asks what you need to think about next.",
    meta: [["see also", "understanding, not memorisation"]],
  },
];

export function MethodSection() {
  const { themeMode, mounted } = useThemeMode();
  const isDark = mounted && themeMode === "obsidian";

  return (
    <section className="lp-section is-band" id="method">
      <div className="lp-wrap">
        <SectionHeader
          label="the method"
          title="Why Feynduck works."
          copy="Feynman Technique helps you explain. Rubber ducking helps you hear the gap. Feynduck helps you find the step you skipped."
        />
        <div className="lp-grid-3 lp-reveal" aria-label="Feynman Technique, Rubber Ducking, and Feynduck definitions">
          {definitions.map((item) => (
            <article
              className={`lp-card lp-define ${item.term === "feynduck" ? "is-feynduck" : ""}`}
              key={item.term}
            >
              <h3>{item.term}</h3>
              <p className="fd-kicker">{item.phonetic}</p>
              <blockquote>{item.definition}</blockquote>
              <dl>
                {item.meta.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
        <figure className="lp-banner lp-reveal">
          <img
            src={isDark ? "/wide_banner_dark.png" : "/wide_banner.png"}
            alt="Feynduck workflow diagram"
          />
        </figure>
      </div>
    </section>
  );
}
