import type { ExplanationResult } from "../types";

export const mockExplanationResult: ExplanationResult = {
  clarityScore: 62,
  gapType: "missing_causal_link",
  gapSummary: "You mentioned oxygen is needed, but did not explain how it helps regenerate NAD+.",
  whyItMatters: "Without this link, the explanation sounds memorised instead of understood.",
  socraticQuestion: "What happens to NADH if oxygen is unavailable?",
  suggestedReExplanationPrompt:
    "Try explaining the link between oxygen, the electron transport chain, NADH, and NAD+.",
};
