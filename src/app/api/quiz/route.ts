import { NextResponse } from "next/server";
import { getOpenAIClient, getOpenAIKeyStatus, isLocalDevelopment, logOpenAIConfig } from "@src/lib/openai";

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

function getOpenAIErrorStatus(error: unknown) {
  const candidate = error as { status?: number; code?: string };
  if (candidate.status === 401) return 401;
  if (candidate.status === 402 || candidate.code === "insufficient_quota") return 402;
  if (candidate.status === 429) return 503;
  if (candidate.status && candidate.status >= 500) return 502;
  return 500;
}

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
  let body: QuizBody;

  try {
    body = (await request.json()) as QuizBody;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (typeof body.sourceMaterial !== "string" || body.sourceMaterial.trim().length < 10) {
    return NextResponse.json({ error: "Source material is required." }, { status: 400 });
  }

  if (body.sourceMaterial.length > 30000) {
    return NextResponse.json({ error: "Source material is too large for quiz generation." }, { status: 400 });
  }

  if (typeof body.selectedConcept !== "string" || body.selectedConcept.trim().length < 2) {
    return NextResponse.json({ error: "Selected concept is required." }, { status: 400 });
  }

  const keyStatus = getOpenAIKeyStatus();
  if (keyStatus.state === "placeholder" || keyStatus.state === "malformed") {
    return NextResponse.json({ error: "OpenAI API key is invalid." }, { status: 401 });
  }

  const openai = getOpenAIClient();
  if (!openai) {
    return NextResponse.json({ error: "OpenAI is not configured for quiz generation." }, { status: 503 });
  }

  const model = process.env.OPENAI_STUDY_TOOLS_MODEL || process.env.OPENAI_EVALUATOR_MODEL || "gpt-4o-mini";
  logOpenAIConfig(model);

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: quizPrompt },
        {
          role: "user",
          content: JSON.stringify({
            sourceMaterial: body.sourceMaterial.trim(),
            selectedConcept: body.selectedConcept.trim(),
            explanationAttempts: Array.isArray(body.explanationAttempts)
              ? body.explanationAttempts.filter((attempt): attempt is string => typeof attempt === "string").slice(-5)
              : [],
            latestEvaluation: body.latestEvaluation,
          }),
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      return NextResponse.json({ error: "OpenAI returned an empty quiz response." }, { status: 502 });
    }

    const parsed = JSON.parse(content) as { questions?: unknown };
    const questions = cleanQuestions(parsed.questions);

    if (!questions.length) {
      return NextResponse.json({ error: "Quiz generation returned no usable questions." }, { status: 500 });
    }

    return NextResponse.json({ questions });
  } catch (error) {
    if (isLocalDevelopment()) {
      console.error("[OpenAI] quiz generation failed", error);
    }

    return NextResponse.json(
      { error: "Feynduck could not generate a quiz right now." },
      { status: getOpenAIErrorStatus(error) },
    );
  }
}
