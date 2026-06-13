import { NextResponse } from "next/server";
import { EvaluationError, evaluateExplanation } from "@src/features/explanation/api/evaluateExplanation";
import { getOpenAIKeyStatus, isLocalDevelopment } from "@src/lib/openai";

type ExplainBody = {
  notes?: unknown;
  explanation?: unknown;
  selectedConcept?: unknown;
  previousExplanations?: unknown;
};

export async function POST(request: Request) {
  let body: ExplainBody;

  try {
    body = (await request.json()) as ExplainBody;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  // Validation: 400 if missing or too short (e.g., < 10 chars)
  if (typeof body.notes !== "string" || body.notes.trim().length < 10) {
    return NextResponse.json(
      { error: "Notes are required and must be at least 10 characters long." },
      { status: 400 },
    );
  }

  if (typeof body.explanation !== "string" || body.explanation.trim().length < 10) {
    return NextResponse.json(
      { error: "Explanation is required and must be at least 10 characters long." },
      { status: 400 },
    );
  }

  if (typeof body.selectedConcept !== "string" || body.selectedConcept.trim().length < 2) {
    return NextResponse.json(
      { error: "Selected concept is required before evaluating an explanation." },
      { status: 400 },
    );
  }

  const keyStatus = getOpenAIKeyStatus();
  const allowMock = isLocalDevelopment() && keyStatus.state === "missing";

  if (keyStatus.state === "placeholder" || keyStatus.state === "malformed") {
    return NextResponse.json(
      { error: "OpenAI API key is invalid. Set a real OPENAI_API_KEY on the server." },
      { status: 401 },
    );
  }

  if (keyStatus.state === "missing" && !allowMock) {
    return NextResponse.json(
      { error: "OpenAI is not configured. Set OPENAI_API_KEY on the server." },
      { status: 500 },
    );
  }

  try {
    const evaluation = await evaluateExplanation(
      {
        notes: body.notes.trim(),
        selectedConcept: body.selectedConcept.trim(),
        explanation: body.explanation.trim(),
        previousExplanations: Array.isArray(body.previousExplanations)
          ? body.previousExplanations.filter((item): item is string => typeof item === "string")
          : undefined,
      },
      { allowMock },
    );

    return NextResponse.json({
      ...evaluation.result,
      mockMode: evaluation.mockMode,
      warning: evaluation.warning,
    });
  } catch (error) {
    if (error instanceof EvaluationError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { error: "Feynduck could not evaluate this explanation right now." },
      { status: 502 },
    );
  }
}
