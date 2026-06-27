import { GitBranch, Library, Link2, MessageCircleMore } from "lucide-react";
import { SectionHeader } from "./SectionHeader";

const loopStages = [
  {
    title: "Source material",
    copy: "Notes, PDFs, slides, and reading stay attached to the room.",
  },
  {
    title: "Your explanation",
    copy: "You teach the idea in your own words before Feynduck evaluates it.",
  },
  {
    title: "Missing link",
    copy: "The skipped mechanism is isolated instead of buried in generic feedback.",
  },
  {
    title: "Better explanation",
    copy: "One follow-up question pulls the reasoning back into place.",
  },
];

const featureGroups = [
  {
    title: "A focused room",
    copy: "Keep the material, concept, and explanation in one place.",
    icon: Library,
    items: ["Study rooms", "Source-grounded feedback"],
  },
  {
    title: "A sharper diagnosis",
    copy: "See exactly where the reasoning breaks, and whether it improves.",
    icon: Link2,
    items: ["Missing-link detection", "Clarity score"],
  },
  {
    title: "A way back in",
    copy: "Repair the gap with one targeted question, then try again.",
    icon: MessageCircleMore,
    items: ["Socratic follow-ups", "Re-explanation loop"],
  },
];

export function ProductFeaturesSection() {
  return (
    <section className="section product-features">
      <SectionHeader
        label="what you get"
        title="A study loop, not another pile of materials."
        copy="Everything points back to one question: can you explain the mechanism without hiding behind recognition?"
      />
      <div className="feature-loop reveal">
        <div className="loop-diagram" aria-label="Feynduck study loop">
          {loopStages.map((stage, index) => (
            <article className="loop-stage" key={stage.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{stage.title}</h3>
              <p>{stage.copy}</p>
            </article>
          ))}
        </div>
        <div className="feature-grid">
          {featureGroups.map((feature) => {
            const Icon = feature.icon;
            return (
              <article className="feature-card" key={feature.title}>
                <span>
                  <Icon size={18} />
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.copy}</p>
                <ul>
                  {feature.items.map((item) => (
                    <li key={item}>
                      <GitBranch size={14} />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
