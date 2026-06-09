import { NextResponse } from "next/server";
import { evaluateExplanation } from "@/features/explanation";
import { getOpenAIClient } from "@/lib/openai";

type ExplainBody = {
  notes?: unknown;
  explanation?: unknown;
};

export async function POST(request: Request) {
  let body: ExplainBody;

  try {
    body = (await request.json()) as ExplainBody;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (typeof body.notes !== "string" || body.notes.trim().length === 0) {
    return NextResponse.json({ error: "notes is required." }, { status: 400 });
  }

  if (typeof body.explanation !== "string" || body.explanation.trim().length === 0) {
    return NextResponse.json({ error: "explanation is required." }, { status: 400 });
  }

  const openAIClient = getOpenAIClient();

  const result = await evaluateExplanation(
    { notes: body.notes.trim(), explanation: body.explanation.trim() },
    { hasOpenAIClient: Boolean(openAIClient) },
  );

  return NextResponse.json(result);
}
