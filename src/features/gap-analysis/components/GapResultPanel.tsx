import { Card } from "@/components/ui";
import type { GapAnalysisResult } from "../types";

type GapResultPanelProps = {
  result: GapAnalysisResult | null;
  isLoading?: boolean;
};

export function GapResultPanel({ result, isLoading = false }: GapResultPanelProps) {
  return (
    <Card className="study-result-panel">
      <div className="study-result-header">
        <span>Clarity Score</span>
        <strong>{result ? result.clarityScore : "--"}</strong>
      </div>

      <div className="study-result-grid">
        <ResultBlock
          label="Main gap"
          value={result?.gapSummary}
          placeholder={isLoading ? "Finding the gap..." : "Your main reasoning gap will appear here."}
        />
        <ResultBlock
          label="Why it matters"
          value={result?.whyItMatters}
          placeholder="Feynduck will explain why this gap weakens your understanding."
        />
        <ResultBlock
          label="Socratic follow-up question"
          value={result?.socraticQuestion}
          placeholder="A targeted follow-up question will appear here."
        />
        <ResultBlock
          label="Re-explain prompt"
          value={result?.suggestedReExplanationPrompt}
          placeholder="Use this prompt to try the explanation again."
        />
      </div>
    </Card>
  );
}

function ResultBlock({
  label,
  value,
  placeholder,
}: {
  label: string;
  value?: string;
  placeholder: string;
}) {
  return (
    <section className="study-result-block">
      <h3>{label}</h3>
      <p>{value ?? placeholder}</p>
    </section>
  );
}
