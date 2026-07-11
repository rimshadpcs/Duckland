import { Brain, Check, MessageCircleQuestion, Network } from "lucide-react";
import { Duck } from "./Duck";
import { SectionHeader } from "./SectionHeader";

const generalAi = [
  "Answers your question",
  "Creates polished summaries and study materials",
  "Makes it easy to recognise an answer",
  "Optimises for an immediately helpful response",
];

const feynduck = [
  "Questions your explanation",
  "Finds the exact gap in your reasoning",
  "Makes you rebuild the missing link yourself",
  "Tracks whether your understanding improves",
];

export function AiComparisonSection() {
  return (
    <section className="section ai-comparison">
      <SectionHeader
        label="why not ChatGPT or NotebookLM?"
        title="Getting an answer is not the same as understanding it."
        copy="General AI tools are useful for finding and generating information. Feynduck is built for the harder part: proving the reasoning is actually yours."
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
          <p>One study session finds a gap. Repeated sessions show how your understanding grows across a degree.</p>
        </div>
        <article>
          <Brain size={20} />
          <h4>Clarity Score</h4>
          <p>Turn vague confidence into a visible signal and track improvement after every explanation.</p>
        </article>
        <article>
          <Network size={20} />
          <h4>Mastery Map</h4>
          <p>See which concepts are clear, which need work, and where missing foundations affect what comes next.</p>
        </article>
      </div>
    </section>
  );
}
