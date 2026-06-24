import { NextResponse } from "next/server";
import { getOpenAIClient, getOpenAIKeyStatus, isLocalDevelopment, logOpenAIConfig } from "@src/lib/openai";
import { getRoomLearningPath, saveGeneratedStudyPath, type GeneratedStudyPath } from "@src/lib/repositories/study-path";

type StudyPathRequestBody = {
  roomId?: unknown;
  source?: unknown;
  sourceTitle?: unknown;
};

const studyPathPrompt = `
You create a structured learning path for Feynduck from a student's source material.

Rules:
- Use only concepts explicitly supported by the supplied source.
- Create 3-6 units.
- Each unit must contain 3-7 concrete concepts.
- Order units from foundational ideas to dependent ideas.
- Do not use generic labels like "Main definition", "Key mechanism", or "Cause and effect".
- Keep unit titles between 2 and 7 words.
- Keep concept titles between 2 and 6 words.
- Descriptions must be one sentence and grounded in the source.
- Include prerequisites only when the dependency is directly supported by the source.
- Do not add external knowledge.

Return only JSON:
{
  "units": [
    {
      "title": "Unit title",
      "description": "One sentence.",
      "concepts": [
        {
          "title": "Concept title",
          "description": "One sentence.",
          "prerequisites": ["Earlier concept title"]
        }
      ]
    }
  ]
}
`;

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

function cleanStudyPath(value: unknown): GeneratedStudyPath {
  if (!value || typeof value !== "object") return { units: [] };
  const rawUnits = (value as { units?: unknown }).units;
  if (!Array.isArray(rawUnits)) return { units: [] };

  const unitTitles = new Set<string>();
  const conceptTitles = new Set<string>();

  const units = rawUnits
    .map((rawUnit) => {
      if (!rawUnit || typeof rawUnit !== "object") return null;
      const unitRecord = rawUnit as Record<string, unknown>;
      const title = cleanText(unitRecord.title, 90);
      if (title.length < 2) return null;
      const unitKey = title.toLowerCase();
      if (unitTitles.has(unitKey)) return null;
      unitTitles.add(unitKey);

      const concepts = Array.isArray(unitRecord.concepts)
        ? unitRecord.concepts
            .map((rawConcept) => {
              if (!rawConcept || typeof rawConcept !== "object") return null;
              const conceptRecord = rawConcept as Record<string, unknown>;
              const conceptTitle = cleanText(conceptRecord.title, 80);
              if (conceptTitle.length < 2) return null;
              const conceptKey = conceptTitle.toLowerCase();
              if (conceptTitles.has(conceptKey)) return null;
              conceptTitles.add(conceptKey);

              return {
                title: conceptTitle,
                description: cleanText(conceptRecord.description, 180) || undefined,
                prerequisites: Array.isArray(conceptRecord.prerequisites)
                  ? conceptRecord.prerequisites
                      .map((item) => cleanText(item, 80))
                      .filter(Boolean)
                      .slice(0, 3)
                  : [],
              };
            })
            .filter((concept): concept is NonNullable<typeof concept> => Boolean(concept))
            .slice(0, 7)
        : [];

      if (!concepts.length) return null;

      return {
        title,
        description: cleanText(unitRecord.description, 180) || undefined,
        concepts,
      };
    })
    .filter((unit): unit is NonNullable<typeof unit> => Boolean(unit))
    .slice(0, 6);

  return { units };
}

export async function POST(request: Request) {
  let body: StudyPathRequestBody;

  try {
    body = (await request.json()) as StudyPathRequestBody;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const roomId = cleanText(body.roomId, 80);
  const source = typeof body.source === "string" ? body.source.trim() : "";
  const sourceTitle = cleanText(body.sourceTitle, 120);

  if (!roomId) return NextResponse.json({ error: "roomId is required." }, { status: 400 });
  if (source.length < 10) return NextResponse.json({ error: "source is required." }, { status: 400 });

  const existing = await getRoomLearningPath(roomId);
  if (existing.concepts.length > 0) {
    return NextResponse.json({ units: existing.units, concepts: existing.concepts, reused: true });
  }

  const keyStatus = getOpenAIKeyStatus();
  if (keyStatus.state === "placeholder" || keyStatus.state === "malformed") {
    return NextResponse.json({ error: "OpenAI API key is invalid." }, { status: 401 });
  }

  const openai = getOpenAIClient();
  let path: GeneratedStudyPath | null = null;

  if (openai) {
    const model = process.env.OPENAI_CONCEPT_MODEL || process.env.OPENAI_EVALUATOR_MODEL || "gpt-4o-mini";
    logOpenAIConfig(model);

    try {
      const response = await openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: studyPathPrompt },
          { role: "user", content: `Source title: ${sourceTitle || "Untitled source"}\n\nSource material:\n${source}` },
        ],
        response_format: { type: "json_object" },
      });

      const content = response.choices[0].message.content;
      if (!content) throw new Error("Empty study path response.");
      path = cleanStudyPath(JSON.parse(content));
    } catch (error) {
      if (isLocalDevelopment()) {
        console.error("[OpenAI] study path generation failed", error);
      }
    }
  }

  if (!path?.units.length) {
    return NextResponse.json({ error: "I couldn't build a learning path from that source yet." }, { status: 502 });
  }

  const savedPath = await saveGeneratedStudyPath(roomId, path);
  return NextResponse.json({
    units: savedPath.units,
    concepts: savedPath.concepts,
    missingSchema: savedPath.missingSchema,
  });
}
