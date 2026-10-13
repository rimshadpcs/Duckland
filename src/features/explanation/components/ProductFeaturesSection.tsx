import { GitBranch, Library, Link2, MessageCircleMore } from "lucide-react";
import { SectionHeader } from "./SectionHeader";

const loopStages = [
  {
    title: "Course materials",
    copy: "Notes, slides, readings, and what you are studying stay attached to the room.",
  },
  {
    title: "Your explanation",
    copy: "You teach the idea in your own words before Feynduck evaluates it.",
  },
  {
    title: "The step you skipped",
    copy: "Feynduck points to the missing step instead of burying it in generic feedback.",
  },
  {
    title: "Clearer explanation",
    copy: "One follow-up question helps you rebuild how the ideas connect.",
  },
];

const featureGroups = [
  {
    title: "A focused room",
    copy: "Keep your notes, slides, readings, concept, and explanation in one place.",
    icon: Library,
    items: ["Study rooms", "Feedback based on your materials"],
  },
  {
    title: "A clearer gap",
    copy: "See exactly which step you skipped, and whether your next attempt is better.",
    icon: Link2,
    items: ["The missing step in your explanation", "Clarity Score"],
  },
  {
    title: "A way back in",
    copy: "Repair the gap with one targeted question, then try again.",
    icon: MessageCircleMore,
    items: ["Targeted follow-up questions", "Explain it again until it is clear"],
  },
];

export function ProductFeaturesSection() {
  return (
    <section className="section product-features">
      <SectionHeader
        label="what you get"
        title="A better way to test your understanding."
        copy="Study Rooms, flashcards, and quizzes all support the same outcome: explain the idea, find the gap, and practise from memory until it is clear."
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
