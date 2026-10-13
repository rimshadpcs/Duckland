import { NextResponse } from "next/server";
import {
  generateJson,
  getStudyToolsModel,
  jsonArray,
  jsonObject,
  jsonString,
  jsonStringArray,
} from "@src/lib/ai/claude";
import { aiErrorResponse, guardUserAIRequest, jsonError } from "@src/lib/api/guards";
import { MAX_SOURCE_CHARS, SOURCE_TOO_LARGE_MESSAGE, cleanText } from "@src/lib/api/input";
import { getRoomLearningPath, saveGeneratedStudyPath, type GeneratedStudyPath } from "@src/lib/repositories/study-path";
import { getCombinedRoomSourceContent } from "@src/lib/repositories/sources";

type StudyPathRequestBody = {
  roomId?: unknown;
  force?: unknown;
};

const studyPathSchema = jsonObject({
  units: jsonArray(
    jsonObject({
      title: jsonString,
      description: jsonString,
      concepts: jsonArray(
        jsonObject({
          title: jsonString,
          description: jsonString,
          prerequisites: jsonStringArray,
        }),
      ),
    }),
  ),
});

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
  const blocked = await guardUserAIRequest();
  if (blocked) return blocked;

  let body: StudyPathRequestBody;

  try {
    body = (await request.json()) as StudyPathRequestBody;
  } catch {
    return jsonError("Request body must be valid JSON.", 400);
  }

  const roomId = cleanText(body.roomId, 80);
  const force = body.force === true;

  if (!roomId) return jsonError("roomId is required.", 400);

  // Row-level security scopes this to the signed-in user's rooms, so another user's roomId has no sources.
  const combinedSource = await getCombinedRoomSourceContent(roomId);
  const source = combinedSource.content.trim();
  const sourceTitle = combinedSource.sources.map((item) => item.title).join(", ");

  if (!combinedSource.sourceCount || source.length < 10) {
    return jsonError("Add material before generating a learning path.", 400);
  }

  if (combinedSource.totalCharacters > MAX_SOURCE_CHARS) {
    return jsonError(SOURCE_TOO_LARGE_MESSAGE, 413);
  }

  const existing = await getRoomLearningPath(roomId);
  if (existing.concepts.length > 0 && !force) {
    return NextResponse.json({ units: existing.units, concepts: existing.concepts, reused: true });
  }

  let path: GeneratedStudyPath;
  try {
    const generated = await generateJson({
      route: "study-path",
      model: getStudyToolsModel(),
      effort: "medium",
      system: studyPathPrompt,
      context: `Source title: ${sourceTitle || "Untitled source"}\n\nSource material:\n${source}`,
      prompt: "Build the learning path for this source material.",
      schema: studyPathSchema,
    });
    path = cleanStudyPath(generated, source);
  } catch (error) {
    return aiErrorResponse(error, "I couldn't build a learning path from that source yet.");
  }

  if (!path.units.length) {
    return jsonError("I couldn't build a learning path from that source yet.", 502);
  }

  const savedPath = await saveGeneratedStudyPath(roomId, path, { mergeExisting: force });
  return NextResponse.json({
    units: savedPath.units,
    concepts: savedPath.concepts,
    missingSchema: savedPath.missingSchema,
    merged: force,
  });
}
