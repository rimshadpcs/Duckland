import type { ExplanationResult } from "../types";
import type { ExplanationRequest } from "../types";

function summariseTopic(text: string) {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 4)
    .join(" ") || "your notes";
}

export function createMockExplanationResult(request: ExplanationRequest): ExplanationResult {
  const sourceTopic = request.selectedConcept || summariseTopic(request.notes);
  const explanationTopic = summariseTopic(request.explanation);

  return {
    status: "gap_found",
    sourceTopic,
    explanationTopic,
    clarityScore: 62,
    gapType: "missing_mechanism",
    gapSummary:
      `You gave a plausible explanation of ${sourceTopic}, but the mock evaluator cannot identify the real missing reasoning link without OpenAI configured.`,
    whyItMatters:
      "This local mock only proves the interface works. Configure OpenAI to get grounded feedback from your actual source material.",
    socraticQuestion:
      "What exact step from your notes connects your claim to the conclusion you reached?",
    suggestedReExplanationPrompt:
      "Try explaining the mechanism step by step, using only the source material on the left.",
    chatMessage:
      "Using mock feedback because OpenAI is not configured. To test the real Feynduck evaluator, add a valid OpenAI API key.",
  };
}
