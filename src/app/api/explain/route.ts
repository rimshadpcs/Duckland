import { NextResponse } from "next/server";
import { evaluateExplanation } from "@src/features/explanation/api/evaluateExplanation";
import { isLocalDevelopment } from "@src/lib/ai/claude";
import { aiErrorResponse, guardUserAIRequest, jsonError } from "@src/lib/api/guards";
import {
  MAX_EXPLANATION_CHARS,
  MAX_SOURCE_CHARS,
  SOURCE_TOO_LARGE_MESSAGE,
  cleanText,
  recentStrings,
} from "@src/lib/api/input";

type ExplainBody = {
  notes?: unknown;
  explanation?: unknown;
  selectedConcept?: unknown;
  previousExplanations?: unknown;
  previousMainGaps?: unknown;
  previousSocraticQuestions?: unknown;
  resolvedGaps?: unknown;
};

export async function POST(request: Request) {
  const blocked = await guardUserAIRequest();
  if (blocked) return blocked;

  let body: ExplainBody;

  try {
    body = (await request.json()) as ExplainBody;
  } catch {
    return jsonError("Request body must be valid JSON.", 400);
  }

  if (typeof body.notes !== "string" || body.notes.trim().length < 10) {
    return jsonError("Notes are required and must be at least 10 characters long.", 400);
  }

  if (body.notes.length > MAX_SOURCE_CHARS) {
    return jsonError(SOURCE_TOO_LARGE_MESSAGE, 413);
  }

  if (typeof body.explanation !== "string" || body.explanation.trim().length < 10) {
    return jsonError("Explanation is required and must be at least 10 characters long.", 400);
  }

  if (body.explanation.length > MAX_EXPLANATION_CHARS) {
    return jsonError("Keep your explanation under 10,000 characters.", 413);
  }

  const selectedConcept = cleanText(body.selectedConcept, 160);
  if (selectedConcept.length < 2) {
    return jsonError("Selected concept is required before evaluating an explanation.", 400);
  }

  try {
    const evaluation = await evaluateExplanation(
      {
        notes: body.notes.trim(),
        selectedConcept,
        explanation: body.explanation.trim(),
        previousExplanations: recentStrings(body.previousExplanations),
        previousMainGaps: recentStrings(body.previousMainGaps),
        previousSocraticQuestions: recentStrings(body.previousSocraticQuestions),
        resolvedGaps: recentStrings(body.resolvedGaps, 12),
      },
      { allowMock: isLocalDevelopment() },
    );

    return NextResponse.json({
      ...evaluation.result,
      mockMode: evaluation.mockMode,
      warning: evaluation.warning,
    });
  } catch (error) {
    return aiErrorResponse(error, "Feynduck could not evaluate this explanation right now.");
  }
}
