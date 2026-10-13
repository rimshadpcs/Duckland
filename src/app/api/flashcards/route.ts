import { NextResponse } from "next/server";
import {
  generateJson,
  getStudyToolsModel,
  jsonArray,
  jsonEnum,
  jsonObject,
  jsonString,
} from "@src/lib/ai/claude";
import { aiErrorResponse, guardUserAIRequest, jsonError } from "@src/lib/api/guards";
import {
  MAX_SOURCE_CHARS,
  SOURCE_TOO_LARGE_MESSAGE,
  cleanText,
  recentStrings,
  summariseEvaluation,
} from "@src/lib/api/input";

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

const flashcardsSchema = jsonObject({
  cards: jsonArray(
    jsonObject({
      id: jsonString,
      front: jsonString,
      back: jsonString,
      focus: jsonString,
      priority: jsonEnum(["high", "medium", "low"]),
    }),
  ),
});

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
  const blocked = await guardUserAIRequest();
  if (blocked) return blocked;

  let body: FlashcardsBody;

  try {
    body = (await request.json()) as FlashcardsBody;
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
      route: "flashcards",
      model: getStudyToolsModel(),
      effort: "low",
      system: flashcardsPrompt,
      context: `Source material:\n${body.sourceMaterial.trim()}`,
      prompt: JSON.stringify({
        selectedConcept,
        explanationAttempts: recentStrings(body.explanationAttempts),
        latestEvaluation: summariseEvaluation(body.latestEvaluation),
      }),
      schema: flashcardsSchema,
    })) as { cards?: unknown };

    const cards = cleanCards(generated.cards);

    if (!cards.length) {
      return jsonError("Flashcard generation returned no usable cards.", 502);
    }

    return NextResponse.json({ cards });
  } catch (error) {
    return aiErrorResponse(error, "Feynduck could not generate flashcards right now.");
  }
}
