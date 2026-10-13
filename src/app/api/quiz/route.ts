import { NextResponse } from "next/server";
import {
  generateJson,
  getStudyToolsModel,
  jsonArray,
  jsonInteger,
  jsonObject,
  jsonString,
  jsonStringArray,
} from "@src/lib/ai/claude";
import { aiErrorResponse, guardUserAIRequest, jsonError } from "@src/lib/api/guards";
import {
  MAX_SOURCE_CHARS,
  SOURCE_TOO_LARGE_MESSAGE,
  cleanText,
  recentStrings,
  summariseEvaluation,
} from "@src/lib/api/input";

type QuizBody = {
  sourceMaterial?: unknown;
  selectedConcept?: unknown;
  explanationAttempts?: unknown;
  latestEvaluation?: unknown;
};

type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
  focus: string;
};

const quizPrompt = `
You generate focused multiple-choice quiz questions for Feynduck.

Rules:
- Generate 3-5 MCQs grounded only in the supplied source.
- Focus primarily on the selected concept.
- Prioritise the learner's unresolved gaps.
- Include resolved gaps occasionally for reinforcement.
- Do not ask about unrelated parts of the source.
- Avoid trivial wording-copy questions.
- Test mechanism, cause and effect, and application.
- Each question must have exactly four answer options.
- Only one answer may be correct.
- Distractors must be plausible but clearly wrong according to the source.
- Provide a concise explanation for the correct answer.
- Do not reveal the answer in the question or options.
- If the last explanation was off-topic, ignore it and focus on the selected concept, source material, and any prior valid gaps.

Return only JSON:
{
  "questions": [
    {
      "id": "q1",
      "question": "Question text",
      "options": ["A", "B", "C", "D"],
      "correctAnswerIndex": 0,
      "explanation": "Why the correct answer is right.",
      "focus": "Gap or concept focus"
    }
  ]
}
`;

const quizSchema = jsonObject({
  questions: jsonArray(
    jsonObject({
      id: jsonString,
      question: jsonString,
      options: jsonStringArray,
      correctAnswerIndex: jsonInteger,
      explanation: jsonString,
      focus: jsonString,
    }),
  ),
});

function cleanQuestions(questions: unknown): QuizQuestion[] {
  if (!Array.isArray(questions)) return [];

  return questions
    .map((question, index) => {
      if (!question || typeof question !== "object") return null;
      const item = question as Record<string, unknown>;
      const text = typeof item.question === "string" ? item.question.trim() : "";
      const options = Array.isArray(item.options)
        ? item.options.filter((option): option is string => typeof option === "string" && option.trim().length > 0).map((option) => option.trim())
        : [];
      const correctAnswerIndex = typeof item.correctAnswerIndex === "number" ? item.correctAnswerIndex : -1;
      const explanation = typeof item.explanation === "string" ? item.explanation.trim() : "";
      const focus = typeof item.focus === "string" ? item.focus.trim() : "Selected concept";

      if (!text || options.length !== 4 || correctAnswerIndex < 0 || correctAnswerIndex > 3 || !explanation) {
        return null;
      }

      return {
        id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : `q${index + 1}`,
        question: text.slice(0, 320),
        options: options.map((option) => option.slice(0, 180)),
        correctAnswerIndex,
        explanation: explanation.slice(0, 420),
        focus: focus.slice(0, 120),
      };
    })
    .filter((question): question is QuizQuestion => Boolean(question))
    .slice(0, 5);
}

export async function POST(request: Request) {
  const blocked = await guardUserAIRequest();
  if (blocked) return blocked;

  let body: QuizBody;

  try {
    body = (await request.json()) as QuizBody;
  } catch {
    return jsonError("Request body must be valid JSON.", 400);
  }

  if (typeof body.sourceMaterial !== "string" || body.sourceMaterial.trim().length < 10) {
    return jsonError("Source material is required.", 400);
  }

  if (body.sourceMaterial.length > MAX_SOURCE_CHARS) {
    return jsonError(SOURCE_TOO_LARGE_MESSAGE, 413);
  }

  const selectedConcept = cleanText(body.selectedConcept, 160);
  if (selectedConcept.length < 2) {
    return jsonError("Selected concept is required.", 400);
  }

  try {
    const generated = (await generateJson({
      route: "quiz",
      model: getStudyToolsModel(),
      effort: "medium",
      system: quizPrompt,
      context: `Source material:\n${body.sourceMaterial.trim()}`,
      prompt: JSON.stringify({
        selectedConcept,
        explanationAttempts: recentStrings(body.explanationAttempts),
        latestEvaluation: summariseEvaluation(body.latestEvaluation),
      }),
      schema: quizSchema,
    })) as { questions?: unknown };

    const questions = cleanQuestions(generated.questions);

    if (!questions.length) {
      return jsonError("Quiz generation returned no usable questions.", 502);
    }

    return NextResponse.json({ questions });
  } catch (error) {
    return aiErrorResponse(error, "Feynduck could not generate a quiz right now.");
  }
}
