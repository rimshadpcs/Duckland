import { NextResponse } from "next/server";
import { getOpenAIClient, getOpenAIKeyStatus, logOpenAIConfig } from "@src/lib/openai";

const DEMO_EVALUATOR_MODEL =
  process.env.OPENAI_DEMO_EVALUATOR_MODEL || process.env.OPENAI_EVALUATOR_MODEL || "gpt-5.4-mini";

type DemoEvaluateBody = {
  transcript?: unknown;
  topic?: unknown;
  question?: unknown;
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
- Topic: Krebs cycle and oxygen.
- Question: Explain why the Krebs cycle needs oxygen, even though oxygen is not directly used in the cycle.
- The expected missing causal link is that oxygen is the final electron acceptor in the electron transport chain. Without oxygen, NADH cannot unload electrons, so NAD+ is not regenerated. Without NAD+, the Krebs cycle cannot keep running.

Rules:
- Evaluate only the supplied transcript.
- Identify the main missing causal link.
- Be concise and student-readable.
- Ask exactly one Socratic follow-up question.
- Return only valid JSON matching the requested schema.
- Use a clarity score from 0 to 100.
- If the student gives the broad idea but misses NADH/ETC/NAD+ regeneration, score around 55-70.
`;

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
  let body: DemoEvaluateBody;

  try {
    body = (await request.json()) as DemoEvaluateBody;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (typeof body.transcript !== "string" || body.transcript.trim().length < 4) {
    return NextResponse.json({ error: "Transcript is required." }, { status: 400 });
  }

  const keyStatus = getOpenAIKeyStatus();
  if (keyStatus.state === "placeholder" || keyStatus.state === "malformed") {
    return NextResponse.json({ error: "OpenAI API key is invalid." }, { status: 401 });
  }

  const openai = getOpenAIClient();
  if (!openai) {
    return NextResponse.json({ error: "OpenAI is not configured for demo evaluation." }, { status: 503 });
  }

  logOpenAIConfig(DEMO_EVALUATOR_MODEL);

  try {
    const response = await openai.chat.completions.create({
      model: DEMO_EVALUATOR_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: demoEvaluationPrompt },
        {
          role: "user",
          content: JSON.stringify({
            topic: typeof body.topic === "string" ? body.topic : "Krebs cycle and oxygen",
            question:
              typeof body.question === "string"
                ? body.question
                : "Explain why the Krebs cycle needs oxygen, even though oxygen is not directly used in the cycle.",
            transcript: body.transcript.trim(),
            requiredJsonShape: {
              clarityScore: 62,
              scoreLabel: "Getting there",
              summary: "You identified that oxygen matters, but skipped why the Krebs cycle cannot continue.",
              missingLink:
                "Without oxygen, NADH cannot unload electrons through the electron transport chain, so NAD+ is not regenerated.",
              followUpQuestion: "What happens to NADH when oxygen is unavailable?",
              hint: "Think about where NADH normally delivers its electrons.",
            },
          }),
        },
      ],
    });

    const raw = response.choices[0]?.message?.content;
    const parsed = raw ? cleanEvaluation(JSON.parse(raw)) : null;
    if (!parsed) {
      return NextResponse.json({ error: "OpenAI returned an incomplete demo evaluation." }, { status: 502 });
    }

    return NextResponse.json(parsed);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[OpenAI] demo evaluation failed", error);
    }

    return NextResponse.json({ error: "Feynduck could not evaluate that explanation." }, { status: 502 });
  }
}
