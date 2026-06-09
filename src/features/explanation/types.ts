export type ExplanationRequest = {
  notes: string;
  explanation: string;
};

export type ExplanationResult = {
  clarityScore: number;
  gapType: "missing_causal_link" | "unclear_definition" | "unsupported_claim" | "incomplete_sequence";
  gapSummary: string;
  whyItMatters: string;
  socraticQuestion: string;
  suggestedReExplanationPrompt: string;
};
