import type { ExplanationRequest, ExplanationResult } from "../types";
import { mockExplanationResult } from "./mockResult";

export async function evaluateExplanation(
  _request: ExplanationRequest,
  options: { hasOpenAIClient: boolean },
): Promise<ExplanationResult> {
  if (!options.hasOpenAIClient) {
    return mockExplanationResult;
  }

  return mockExplanationResult;
}
