import { NextResponse } from "next/server";
import { generateJson, getStudyToolsModel, jsonObject, jsonString } from "@src/lib/ai/claude";
import { aiErrorResponse, guardUserAIRequest, jsonError } from "@src/lib/api/guards";
import { MAX_SOURCE_CHARS, SOURCE_TOO_LARGE_MESSAGE, cleanText } from "@src/lib/api/input";

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

const followUpSchema = jsonObject({
  answer: jsonString,
  thinking: jsonString,
});

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
  const blocked = await guardUserAIRequest();
  if (blocked) return blocked;

  let body: FollowUpBody;

  try {
    body = (await request.json()) as FollowUpBody;
  } catch {
    return jsonError("Request body must be valid JSON.", 400);
  }

  const sourceMaterial = typeof body.sourceMaterial === "string" ? body.sourceMaterial.trim() : "";
  const selectedConcept = cleanText(body.selectedConcept, 120);
  const question = cleanText(body.question, 500);

  if (sourceMaterial.length < 10) return jsonError("Source material is required.", 400);
  if (sourceMaterial.length > MAX_SOURCE_CHARS) return jsonError(SOURCE_TOO_LARGE_MESSAGE, 413);
  if (!selectedConcept) return jsonError("Selected concept is required.", 400);
  if (question.length < 3) return jsonError("Question is required.", 400);

  try {
    const answer = await generateJson({
      route: "follow-up",
      model: getStudyToolsModel(),
      effort: "low",
      system: followUpPrompt,
      context: `Source material:\n${sourceMaterial}`,
      prompt: [`Selected concept: ${selectedConcept}`, `Question: ${question}`].join("\n\n"),
      schema: followUpSchema,
      maxTokens: 8_000,
    });

    return NextResponse.json(cleanAnswer(answer));
  } catch (error) {
    return aiErrorResponse(error, "Could not answer that follow-up right now.");
  }
}
