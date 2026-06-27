import { NextResponse } from "next/server";
import { getOpenAIClient, getOpenAIKeyStatus, isLocalDevelopment, logOpenAIConfig } from "@src/lib/openai";
import { getRoomLearningPath, saveGeneratedStudyPath, type GeneratedStudyPath } from "@src/lib/repositories/study-path";
import { getCombinedRoomSourceContent } from "@src/lib/repositories/sources";

type StudyPathRequestBody = {
  roomId?: unknown;
  source?: unknown;
  sourceTitle?: unknown;
  force?: unknown;
};

const COMBINED_SOURCE_CHARACTER_LIMIT = 120_000;

const studyPathPrompt = `
You create a structured learning path for Feynduck from a student's source material.

Rules:
- Use only concepts explicitly supported by the supplied source.
- For a short source under 15 pages, target 5-10 total concepts.
- Create 2-5 units.
- Each unit must contain 2-4 concrete concepts.
- Order units from foundational ideas to dependent ideas.
- Do not use generic labels like "Main definition", "Key mechanism", or "Cause and effect".
- Concepts must be concrete, student-readable, source-grounded, independently explainable, and named after the actual term, process, mechanism, or question in the source.
- Keep unit titles between 2 and 7 words.
- Keep concept titles between 2 and 7 words.
- Prefer noun phrases or direct questions: "Next-token prediction", "Transformer architecture", "Why LLMs can perform many tasks".
- Avoid vague abstraction labels such as "Role of Predictions", "Parameter Significance", "Layer Refinement", "General Structure Learning", "Performing Multiple Tasks", "Scaling and Reliability", or "Adaptive Outputs".
- Avoid titles starting with generic phrases like "Role of", "General", "Significance", "Adaptive", "Performing", "Scaling", "Understanding", or "Learning" unless those exact terms are central source terms.
- Merge closely related claims and avoid near-duplicate concepts.
- Do not create a concept for every sentence or every downstream outcome.
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

const vagueTitlePrefixes = [
  "role of",
  "general",
  "significance",
  "adaptive",
  "performing",
  "scaling",
  "understanding",
  "learning",
];

function normalizeTitle(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function countSourcePages(source: string) {
  const matches = source.match(/--- Page \d+ ---/g);
  return matches?.length || 1;
}

function rewriteConceptTitle(title: string, source: string) {
  const normalized = normalizeTitle(title);
  const lowerSource = source.toLowerCase();

  if (
    normalized === "role of predictions" ||
    (normalized.includes("prediction") && lowerSource.includes("next token"))
  ) {
    return "Next-token prediction";
  }

  if (normalized === "performing multiple tasks" && lowerSource.includes("many tasks")) {
    return "Why LLMs can perform many tasks";
  }

  if (normalized === "parameter significance" && lowerSource.includes("parameter")) {
    return "Parameters in LLMs";
  }

  if (normalized === "layer refinement" && lowerSource.includes("transformer layer")) {
    return "Transformer layers";
  }

  if (normalized === "general structure learning" && lowerSource.includes("transformer")) {
    return "Transformer architecture";
  }

  return title;
}

function isVagueConceptTitle(title: string, source: string) {
  const normalized = normalizeTitle(title);
  const lowerSource = source.toLowerCase();

  if (normalized === "large language model" || normalized === "what is a large language model") return false;
  if (normalized.includes("token") || normalized.includes("transformer") || normalized.includes("parameter")) return false;

  return vagueTitlePrefixes.some((prefix) => normalized.startsWith(prefix) && !lowerSource.includes(normalized));
}

function cleanStudyPath(value: unknown, source: string): GeneratedStudyPath {
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
              const conceptTitle = rewriteConceptTitle(cleanText(conceptRecord.title, 80), source);
              if (conceptTitle.length < 2) return null;
              if (isVagueConceptTitle(conceptTitle, source)) return null;
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
            .slice(0, 4)
        : [];

      if (!concepts.length) return null;

      return {
        title,
        description: cleanText(unitRecord.description, 180) || undefined,
        concepts,
      };
    })
    .filter((unit): unit is NonNullable<typeof unit> => Boolean(unit))
    .slice(0, 5);

  if (countSourcePages(source) < 15) {
    let remainingConcepts = 10;
    return {
      units: units
        .map((unit) => {
          const concepts = unit.concepts.slice(0, remainingConcepts);
          remainingConcepts -= concepts.length;
          return { ...unit, concepts };
        })
        .filter((unit) => unit.concepts.length),
    };
  }

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
  const force = body.force === true;
  const suppliedSource = typeof body.source === "string" ? body.source.trim() : "";
  const suppliedSourceTitle = cleanText(body.sourceTitle, 120);

  if (!roomId) return NextResponse.json({ error: "roomId is required." }, { status: 400 });

  const combinedSource = await getCombinedRoomSourceContent(roomId);
  const source = combinedSource.content.trim() || suppliedSource;
  const sourceTitle = combinedSource.sourceCount
    ? combinedSource.sources.map((item) => item.title).join(", ")
    : suppliedSourceTitle;

  if (!combinedSource.sourceCount && source.length < 10) {
    return NextResponse.json({ error: "Add material before generating a learning path." }, { status: 400 });
  }

  if (combinedSource.totalCharacters > COMBINED_SOURCE_CHARACTER_LIMIT) {
    return NextResponse.json({
      error: "This room has too much active material to map at once.\n\nExclude a source, split the material into another room, or add a smaller section.",
    }, { status: 413 });
  }

  const existing = await getRoomLearningPath(roomId);
  if (existing.concepts.length > 0 && !force) {
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
      path = cleanStudyPath(JSON.parse(content), source);
    } catch (error) {
      if (isLocalDevelopment()) {
        console.error("[OpenAI] study path generation failed", error);
      }
    }
  }

  if (!path?.units.length) {
    return NextResponse.json({ error: "I couldn't build a learning path from that source yet." }, { status: 502 });
  }

  const savedPath = await saveGeneratedStudyPath(roomId, path, { mergeExisting: force });
  return NextResponse.json({
    units: savedPath.units,
    concepts: savedPath.concepts,
    missingSchema: savedPath.missingSchema,
    merged: force,
  });
}
