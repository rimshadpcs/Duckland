import { Brain, Check, MessageCircleQuestion, Network } from "lucide-react";
import { Duck } from "./Duck";
import { SectionHeader } from "./SectionHeader";

const generalAi = [
  "Answers your question",
  "Creates polished summaries from your notes",
  "Makes it easy to recognise an answer",
  "Optimises for an immediately helpful response",
];

const feynduck = [
  "Questions your explanation",
  "Finds the step you skipped",
  "Makes you explain it again until it is clear",
  "Tracks whether your understanding improves",
];

export function AiComparisonSection() {
  return (
    <section className="section ai-comparison">
      <SectionHeader
        label="why not ChatGPT or NotebookLM?"
        title="ChatGPT and NotebookLM can explain a subject to you."
        copy="Feynduck checks whether you can explain it yourself."
      />

      <div className="comparison-grid reveal">
        <article className="comparison-card general-ai-card">
          <span><MessageCircleQuestion size={18} /> ChatGPT &amp; NotebookLM</span>
          <h3>AI does more of the explaining.</h3>
          <ul>
            {generalAi.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </article>
        <article className="comparison-card feynduck-card">
          <span className="comparison-brand"><Duck /> Feynduck</span>
          <h3>You do the explaining.</h3>
          <ul>
            {feynduck.map((item) => (
              <li key={item}><Check size={16} />{item}</li>
            ))}
          </ul>
        </article>
      </div>

      <div className="mastery-value reveal">
        <div>
          <span>Long-term value</span>
          <h3>Build a record of what you can actually explain.</h3>
          <p>One study session finds a gap. Repeated sessions show what you understand, what still needs work, and whether your next attempt is better.</p>
        </div>
        <article>
          <Brain size={20} />
          <h4>Clarity Score</h4>
          <p>A simple measure of how clearly you explained the concept.</p>
        </article>
        <article>
          <Network size={20} />
          <h4>Mastery Map</h4>
          <p>See what you can explain, what still needs work, and which earlier ideas may be holding you back.</p>
        </article>
      </div>
    </section>
  );
}
