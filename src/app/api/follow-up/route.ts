import { NextResponse } from "next/server";
import { getOpenAIClient, getOpenAIKeyStatus, isLocalDevelopment, logOpenAIConfig } from "@src/lib/openai";

type FollowUpBody = {
  sourceMaterial?: unknown;
  selectedConcept?: unknown;
  question?: unknown;
};

type FollowUpAnswer = {
  answer: string;
  thinking: string;
};

const followUpPrompt = `
You answer follow-up study questions for Feynduck.

Rules:
- Use only the supplied source material where possible.
- Focus on the selected concept and the student's question.
- Do not evaluate clarity.
- Do not mention scores, gaps, or completion status.
- If the source does not support a detail, say so briefly and answer only what the source supports.
- Keep the answer concise and student-friendly.

Return only JSON:
{
  "answer": "Short source-grounded explanation.",
  "thinking": "One useful clarification or example."
}
`;

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

function getOpenAIErrorStatus(error: unknown) {
  const candidate = error as { status?: number; code?: string };
  if (candidate.status === 401) return 401;
  if (candidate.status === 402 || candidate.code === "insufficient_quota") return 402;
  if (candidate.status === 429) return 503;
  if (candidate.status && candidate.status >= 500) return 502;
  return 500;
}

function cleanAnswer(value: unknown): FollowUpAnswer {
  if (!value || typeof value !== "object") {
    return {
      answer: "The source does not give enough detail to answer that confidently.",
      thinking: "Try asking about a specific phrase or step from the material.",
    };
  }

  const record = value as Record<string, unknown>;
  return {
    answer: cleanText(record.answer, 700) || "The source does not give enough detail to answer that confidently.",
    thinking: cleanText(record.thinking, 500) || "Try connecting the question back to the source's central mechanism.",
  };
}

export async function POST(request: Request) {
  let body: FollowUpBody;

  try {
    body = (await request.json()) as FollowUpBody;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const sourceMaterial = typeof body.sourceMaterial === "string" ? body.sourceMaterial.trim() : "";
  const selectedConcept = cleanText(body.selectedConcept, 120);
  const question = cleanText(body.question, 500);

  if (sourceMaterial.length < 10) return NextResponse.json({ error: "Source material is required." }, { status: 400 });
  if (!selectedConcept) return NextResponse.json({ error: "Selected concept is required." }, { status: 400 });
  if (question.length < 3) return NextResponse.json({ error: "Question is required." }, { status: 400 });

  const keyStatus = getOpenAIKeyStatus();
  if (keyStatus.state === "placeholder" || keyStatus.state === "malformed") {
    return NextResponse.json({ error: "OpenAI API key is invalid." }, { status: 401 });
  }

  const openai = getOpenAIClient();
  if (!openai) {
    return NextResponse.json({
      answer: "The source-grounded follow-up answer is unavailable because OpenAI is not configured.",
      thinking: "You can still keep studying by turning your question into a specific explanation attempt.",
    });
  }

  const model = process.env.OPENAI_FOLLOW_UP_MODEL || process.env.OPENAI_EVALUATOR_MODEL || "gpt-4o-mini";
  logOpenAIConfig(model);

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: followUpPrompt },
        {
          role: "user",
          content: [
            `Selected concept: ${selectedConcept}`,
            `Question: ${question}`,
            `Source material:\n${sourceMaterial.slice(0, 30000)}`,
          ].join("\n\n"),
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("Empty follow-up response.");

    return NextResponse.json(cleanAnswer(JSON.parse(content)));
  } catch (error) {
    if (isLocalDevelopment()) {
      console.error("[OpenAI] follow-up answer failed", error);
    }

    return NextResponse.json(
      { error: "Could not answer that follow-up right now." },
      { status: getOpenAIErrorStatus(error) },
    );
  }
}
