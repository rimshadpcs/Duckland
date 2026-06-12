export type GapAnalysisResult = {
  status: "ok" | "topic_mismatch";
  sourceTopic: string;
  explanationTopic: string;
  clarityScore: number | null;
  gapType: "missing_mechanism" | "missing_reasoning_link" | "missing_causal_link" | "unclear_definition" | "unsupported_claim" | "incomplete_sequence" | "topic_mismatch";
  gapSummary: string;
  whyItMatters: string;
  socraticQuestion: string;
  suggestedReExplanationPrompt: string;
  chatMessage: string;
};
