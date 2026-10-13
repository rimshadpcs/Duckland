import { NextResponse } from "next/server";
import { generateJson, getEvaluatorModel, jsonInteger, jsonObject, jsonString } from "@src/lib/ai/claude";
import { aiErrorResponse, guardDemoAIRequest, jsonError } from "@src/lib/api/guards";

// The public demo always grades this one question; the topic and question are never taken from the request.
const DEMO_TOPIC = "Krebs cycle and oxygen";
const DEMO_QUESTION = "Explain why the Krebs cycle needs oxygen, even though oxygen is not directly used in the cycle.";
const MAX_TRANSCRIPT_CHARS = 4_000;

type DemoEvaluateBody = {
  transcript?: unknown;
};

type DemoEvaluation = {
  clarityScore: number;
  scoreLabel: string;
  summary: string;
  missingLink: string;
  followUpQuestion: string;
  hint: string;
};

const demoEvaluationPrompt = `
You evaluate a student's spoken Feynduck demo explanation.

Demo context:
- Topic: ${DEMO_TOPIC}.
- Question: ${DEMO_QUESTION}
- The expected missing causal link is that oxygen is the final electron acceptor in the electron transport chain. Without oxygen, NADH cannot unload electrons, so NAD+ is not regenerated. Without NAD+, the Krebs cycle cannot keep running.

Rules:
- Evaluate only the supplied transcript.
- Identify the main missing causal link.
- Be concise and student-readable.
- Ask exactly one Socratic follow-up question.
- Use a clarity score from 0 to 100.
- If the student gives the broad idea but misses NADH/ETC/NAD+ regeneration, score around 55-70.

Example output:
{
  "clarityScore": 62,
  "scoreLabel": "Getting there",
  "summary": "You identified that oxygen matters, but skipped why the Krebs cycle cannot continue.",
  "missingLink": "Without oxygen, NADH cannot unload electrons through the electron transport chain, so NAD+ is not regenerated.",
  "followUpQuestion": "What happens to NADH when oxygen is unavailable?",
  "hint": "Think about where NADH normally delivers its electrons."
}
`;

const demoEvaluationSchema = jsonObject({
  clarityScore: jsonInteger,
  scoreLabel: jsonString,
  summary: jsonString,
  missingLink: jsonString,
  followUpQuestion: jsonString,
  hint: jsonString,
});

function cleanEvaluation(value: unknown): DemoEvaluation | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const clarityScore = typeof item.clarityScore === "number" ? Math.round(item.clarityScore) : NaN;
  const scoreLabel = typeof item.scoreLabel === "string" ? item.scoreLabel.trim() : "";
  const summary = typeof item.summary === "string" ? item.summary.trim() : "";
  const missingLink = typeof item.missingLink === "string" ? item.missingLink.trim() : "";
  const followUpQuestion = typeof item.followUpQuestion === "string" ? item.followUpQuestion.trim() : "";
  const hint = typeof item.hint === "string" ? item.hint.trim() : "";

  if (!Number.isFinite(clarityScore) || !scoreLabel || !summary || !missingLink || !followUpQuestion || !hint) {
    return null;
  }

  return {
    clarityScore: Math.max(0, Math.min(100, clarityScore)),
    scoreLabel: scoreLabel.slice(0, 80),
    summary: summary.slice(0, 260),
    missingLink: missingLink.slice(0, 320),
    followUpQuestion: followUpQuestion.slice(0, 180),
    hint: hint.slice(0, 180),
  };
}

export async function POST(request: Request) {
  const blocked = await guardDemoAIRequest(request);
  if (blocked) return blocked;

  let body: DemoEvaluateBody;

  try {
    body = (await request.json()) as DemoEvaluateBody;
  } catch {
    return jsonError("Request body must be valid JSON.", 400);
  }

  const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";
  if (transcript.length < 4) {
    return jsonError("Transcript is required.", 400);
  }

  if (transcript.length > MAX_TRANSCRIPT_CHARS) {
    return jsonError("Keep the demo answer under 4,000 characters.", 413);
  }

  try {
    const evaluation = cleanEvaluation(
      await generateJson({
        route: "demo-evaluate",
        model: getEvaluatorModel(),
        effort: "low",
        system: demoEvaluationPrompt,
        prompt: `Student transcript:\n${transcript}`,
        schema: demoEvaluationSchema,
        maxTokens: 4_000,
      }),
    );

    if (!evaluation) {
      return jsonError("Feynduck returned an incomplete demo evaluation.", 502);
    }

    return NextResponse.json(evaluation);
  } catch (error) {
    return aiErrorResponse(error, "Feynduck could not evaluate that explanation.");
  }
}
