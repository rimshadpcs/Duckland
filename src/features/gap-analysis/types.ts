export type GapAnalysisResult = {
  status: "ok" | "gap_found" | "clear" | "topic_mismatch";
  sourceTopic: string;
  explanationTopic: string;
  clarityScore: number | null;
  gapType: "missing_mechanism" | "missing_reasoning_link" | "missing_causal_link" | "unclear_definition" | "unsupported_claim" | "incomplete_sequence" | "topic_mismatch";
  gapSummary: string | null;
  mainGap?: string | null;
  whyItMatters: string;
  socraticQuestion: string | null;
  suggestedReExplanationPrompt: string;
  chatMessage: string;
  scoreReason?: string;
  coveredClaims?: string[];
  missingClaims?: string[];
  resolvedGaps?: string[];
};
