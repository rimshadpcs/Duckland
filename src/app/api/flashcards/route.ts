import { NextResponse } from "next/server";
import { getOpenAIClient, getOpenAIKeyStatus, isLocalDevelopment, logOpenAIConfig } from "@src/lib/openai";

type FlashcardsBody = {
  sourceMaterial?: unknown;
  selectedConcept?: unknown;
  explanationAttempts?: unknown;
  latestEvaluation?: unknown;
};

type Flashcard = {
  id: string;
  front: string;
  back: string;
  focus: string;
  priority: "high" | "medium" | "low";
};

const flashcardsPrompt = `
You generate focused study flashcards for Feynduck.

Rules:
- Generate 4-8 flashcards using only information supported by the source.
- Focus on the selected concept.
- Prioritise weak links found in the learner's explanation.
- Include central mechanisms and essential definitions.
- Avoid cards about unrelated source sections.
- Keep fronts concise.
- Keep backs explanatory but brief.
- Prefer understanding-based prompts over simple term memorisation.
- Mark cards based on unresolved gaps as "high" priority.
- If the last explanation was off-topic, ignore it and focus on the selected concept, source material, and any prior valid gaps.

Return only JSON:
{
  "cards": [
    {
      "id": "c1",
      "front": "Question or prompt",
      "back": "Brief explanation",
      "focus": "Gap or concept focus",
      "priority": "high" | "medium" | "low"
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

function cleanCards(cards: unknown): Flashcard[] {
  if (!Array.isArray(cards)) return [];

  return cards
    .map((card, index) => {
      if (!card || typeof card !== "object") return null;
      const item = card as Record<string, unknown>;
      const front = typeof item.front === "string" ? item.front.trim() : "";
      const back = typeof item.back === "string" ? item.back.trim() : "";
      const focus = typeof item.focus === "string" ? item.focus.trim() : "Selected concept";
      const priority = item.priority === "high" || item.priority === "medium" || item.priority === "low"
        ? item.priority
        : "medium";

      if (!front || !back) return null;

      return {
        id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : `c${index + 1}`,
        front: front.slice(0, 220),
        back: back.slice(0, 520),
        focus: focus.slice(0, 120),
        priority,
      };
    })
    .filter((card): card is Flashcard => Boolean(card))
    .slice(0, 8);
}

export async function POST(request: Request) {
  let body: FlashcardsBody;

  try {
    body = (await request.json()) as FlashcardsBody;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (typeof body.sourceMaterial !== "string" || body.sourceMaterial.trim().length < 10) {
    return NextResponse.json({ error: "Source material is required." }, { status: 400 });
  }

  if (body.sourceMaterial.length > 30000) {
    return NextResponse.json({ error: "Source material is too large for flashcard generation." }, { status: 400 });
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
    return NextResponse.json({ error: "OpenAI is not configured for flashcard generation." }, { status: 503 });
  }

  const model = process.env.OPENAI_STUDY_TOOLS_MODEL || process.env.OPENAI_EVALUATOR_MODEL || "gpt-4o-mini";
  logOpenAIConfig(model);

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: flashcardsPrompt },
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
      return NextResponse.json({ error: "OpenAI returned an empty flashcard response." }, { status: 502 });
    }

    const parsed = JSON.parse(content) as { cards?: unknown };
    const cards = cleanCards(parsed.cards);

    if (!cards.length) {
      return NextResponse.json({ error: "Flashcard generation returned no usable cards." }, { status: 500 });
    }

    return NextResponse.json({ cards });
  } catch (error) {
    if (isLocalDevelopment()) {
      console.error("[OpenAI] flashcard generation failed", error);
    }

    return NextResponse.json(
      { error: "Feynduck could not generate flashcards right now." },
      { status: getOpenAIErrorStatus(error) },
    );
  }
}
